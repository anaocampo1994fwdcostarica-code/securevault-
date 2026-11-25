import { Router } from 'express';
import { query } from '../db.js';
import { logEvent } from '../audit.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt } from '../security/crypto.js';
import { phoneSchema } from '../validation/notes.js';

const router = Router();

// A01: todas las rutas de perfil requieren sesión autenticada (RF-05)
router.use(requireAuth);

// GET /api/profile – devuelve perfil con teléfono enmascarado (A02, A04)
router.get('/', async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { rows } = await query(
      'SELECT name, email, role, phone_enc FROM users WHERE id = $1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    const user = rows[0];
    let phoneMasked = null;

    if (user.phone_enc) {
      try {
        const phone = decrypt(user.phone_enc, userId);
        phoneMasked = `***-***-${phone.slice(-4)}`;
      } catch (decryptErr) {
        // A10: fallar cerrado y registrar incidente sin exponer el teléfono
        await logEvent('decrypt_failed', {
          userId,
          ip: req.ip,
          metadata: { resource: 'profile_phone' }
        });
        return next(decryptErr);
      }
    }

    return res.json({
      name: user.name,
      email: user.email,
      role: user.role,
      phone_masked: phoneMasked
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/profile/phone – actualiza el teléfono cifrado del usuario (A04, A09)
router.put('/phone', async (req, res, next) => {
  try {
    const parsed = phoneSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: parsed.error.issues.map((issue) => issue.message)
      });
    }

    const userId = req.session.userId;
    const phoneEnc = encrypt(parsed.data.phone, userId);

    await query(
      'UPDATE users SET phone_enc = $1 WHERE id = $2',
      [phoneEnc, userId]
    );

    // A09: registrar evento sin guardar el número telefónico
    await logEvent('phone_updated', {
      userId,
      ip: req.ip
    });

    return res.status(200).json({ message: 'Teléfono actualizado' });
  } catch (err) {
    return next(err);
  }
});

export default router;
