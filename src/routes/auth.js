import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { logEvent } from '../audit.js';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../security/password.js';
import { registerSchema, loginSchema } from '../validation/auth.js';
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

export default router;
