import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { logEvent } from '../audit.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const uuidSchema = z.string().uuid('Identificador inválido');
const auditLimitSchema = z.coerce.number().int().min(1).max(200).default(50);
const roleUpdateSchema = z
  .object({
    role: z.enum(['user', 'admin'])
  })
  .strict();

// A01: todas las rutas administrativas requieren autenticación y rol 'admin' (RF-07)
router.use(requireAuth, requireRole('admin'));

// GET /api/admin/users – lista usuarios sin exponer secretos ni datos cifrados (A02/A04)
router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, email, name, role, failed_attempts, locked_until, created_at
       FROM users
       ORDER BY created_at DESC`
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// GET /api/admin/audit – consulta bitácora de auditoría con límite validado (A05/A09)
router.get('/audit', async (req, res, next) => {
  try {
    const parsed = auditLimitSchema.safeParse(req.query.limit);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Límite inválido (1 a 200)' });
    }

    const { rows } = await query(
      `SELECT id, event, user_id, ip, metadata, created_at
       FROM audit_logs
       ORDER BY id DESC
       LIMIT $1`,
      [parsed.data]
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/admin/users/:id/role – cambia el rol de un usuario y revoca sus sesiones (A01/A07)
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    const idParsed = uuidSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(400).json({ error: 'Identificador inválido' });
    }

    const bodyParsed = roleUpdateSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({ error: 'Datos de entrada inválidos' });
    }

    const targetUserId = idParsed.data;
    const newRole = bodyParsed.data.role;

    // A01: evitar que un administrador modifique su propio rol
    if (targetUserId === req.session.userId) {
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
    }

    const { rows } = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [targetUserId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    const oldRole = rows[0].role;

    await query(
      'UPDATE users SET role = $1 WHERE id = $2',
      [newRole, targetUserId]
    );

    // A07: cerrar las sesiones del usuario afectado para aplicar el nuevo rol de inmediato
    await query(
      "DELETE FROM session WHERE sess->>'userId' = $1",
      [targetUserId]
    );

    // A09: registrar cambio de privilegios en auditoría
    await logEvent('role_changed', {
      userId: req.session.userId,
      ip: req.ip,
      metadata: { targetUserId, oldRole, newRole }
    });

    return res.json({ id: targetUserId, role: newRole });
  } catch (err) {
    return next(err);
  }
});

export default router;
