import { randomBytes, createHash } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { logEvent } from '../audit.js';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../security/password.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from '../validation/auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// A07: limitador de intentos de login para frenar fuerza bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    await logEvent('login_rate_limited', {
      ip: req.ip,
      metadata: { path: req.originalUrl }
    });
    res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
  }
});

// A07: limitador de registros por IP (10 por hora)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta más tarde.' }
});

// A07: limitador de solicitudes de recuperación de contraseña (5 por hora por IP)
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta más tarde.' }
});

// A07: limitador de intentos de restablecimiento de contraseña (10 por hora por IP)
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Intenta más tarde.' }
});

// POST /api/auth/register
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: parsed.error.issues.map((issue) => issue.message)
      });
    }

    const { email, name, password } = parsed.data;
    const passwordHash = await hashPassword(password);

    // A01: el rol siempre se asigna como 'user' en el servidor
    const { rows } = await query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, name, passwordHash]
    );

    if (rows.length > 0) {
      await logEvent('user_registered', {
        userId: rows[0].id,
        ip: req.ip
      });
    }

    // A07: respuesta idéntica exista o no el correo para evitar enumeración
    return res.status(201).json({
      message: 'Si los datos son válidos, la cuenta fue creada'
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: parsed.error.issues.map((issue) => issue.message)
      });
    }

    const { email, password } = parsed.data;
    const { rows } = await query(
      `SELECT id, email, password_hash, role, failed_attempts, locked_until
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (rows.length === 0) {
      // A07: verificar contra DUMMY_HASH para igualar el tiempo de respuesta
      await verifyPassword(DUMMY_HASH, password);
      await logEvent('login_failed', { ip: req.ip, metadata: { email } });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = rows[0];

    // A07: bloqueo temporal activo sin revelar el estado de la cuenta
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await verifyPassword(DUMMY_HASH, password);
      await logEvent('login_blocked_locked', {
        userId: user.id,
        ip: req.ip,
        metadata: { email }
      });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const isValid = await verifyPassword(user.password_hash, password);
    if (!isValid) {
      const nextAttempts = user.failed_attempts + 1;

      if (nextAttempts >= 5) {
        await query(
          `UPDATE users
           SET failed_attempts = $1,
               locked_until = now() + interval '15 minutes'
           WHERE id = $2`,
          [nextAttempts, user.id]
        );
        await logEvent('account_locked', {
          userId: user.id,
          ip: req.ip,
          metadata: { email }
        });
      } else {
        await query(
          'UPDATE users SET failed_attempts = $1 WHERE id = $2',
          [nextAttempts, user.id]
        );
      }

      await logEvent('login_failed', {
        userId: user.id,
        ip: req.ip,
        metadata: { email }
      });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Reiniciar contador de intentos fallidos y bloqueo al autenticar correctamente
    await query(
      'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1',
      [user.id]
    );

    // A07: regenerar ID de sesión para prevenir fijación de sesión
    req.session.regenerate(async (regenErr) => {
      if (regenErr) {
        return next(regenErr);
      }

      req.session.userId = user.id;
      req.session.role = user.role;

      await logEvent('login_success', {
        userId: user.id,
        ip: req.ip
      });

      return res.status(200).json({ message: 'Sesión iniciada' });
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/logout (RF-02)
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const userId = req.session.userId;
    await logEvent('logout', { userId, ip: req.ip });

    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie('sv.sid');
      return res.status(200).json({ message: 'Sesión cerrada' });
    });
  } catch (err) {
    return next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    // A02/A04: devolver únicamente campos seguros, nunca password_hash
    const { rows } = await query(
      'SELECT id, name, email, role FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    return res.json(rows[0]);
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/forgot-password (RF-06)
router.post('/forgot-password', forgotLimiter, async (req, res, next) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: parsed.error.issues.map((issue) => issue.message)
      });
    }

    const { email } = parsed.data;
    const { rows } = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (rows.length > 0) {
      const userId = rows[0].id;

      // A07: invalidar tokens previos activos del usuario
      await query(
        'UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1 AND used_at IS NULL',
        [userId]
      );

      // A04: generar token criptográfico y almacenar únicamente su hash SHA-256
      const token = randomBytes(32).toString('base64url');
      const tokenHash = createHash('sha256').update(token).digest('hex');

      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '15 minutes')`,
        [userId, tokenHash]
      );

      // A09: registrar solicitud sin guardar el token
      await logEvent('password_reset_requested', {
        userId,
        ip: req.ip
      });

      // A09: nunca imprimir el token en producción
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEV] Enlace de recuperación: http://localhost:3000/reset?token=' + token);
      }
    }

    // A07: respuesta idéntica exista o no el usuario para evitar enumeración
    return res.status(200).json({
      message: 'Si el correo existe, recibirás instrucciones'
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/reset-password (RF-06)
router.post('/reset-password', resetLimiter, async (req, res, next) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: parsed.error.issues.map((issue) => issue.message)
      });
    }

    const { token, password } = parsed.data;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // A07: consumo atómico del token; evita que dos peticiones simultáneas usen el mismo token (race condition)
    const { rows } = await query(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [tokenHash]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    const resetRecord = rows[0];
    const passwordHash = await hashPassword(password);

    // A04/A07: actualizar contraseña y limpiar bloqueos previos
    await query(
      `UPDATE users
       SET password_hash = $1,
           failed_attempts = 0,
           locked_until = NULL
       WHERE id = $2`,
      [passwordHash, resetRecord.user_id]
    );

    // A07: cerrar todas las sesiones activas del usuario
    await query(
      "DELETE FROM session WHERE sess->>'userId' = $1",
      [resetRecord.user_id]
    );

    await logEvent('password_reset_completed', {
      userId: resetRecord.user_id,
      ip: req.ip
    });

    return res.status(200).json({ message: 'Contraseña actualizada' });
  } catch (err) {
    return next(err);
  }
});

export default router;
