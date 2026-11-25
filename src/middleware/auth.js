import { query } from '../db.js';
import { logEvent } from '../audit.js';

/**
 * Middleware que exige una sesión autenticada (A01/A07).
 */
export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  return next();
}

/**
 * Middleware que verifica el rol del usuario consultando la base de datos (A01, RF-03).
 * @param {string} role - Rol requerido ('user' | 'admin').
 */
export function requireRole(role) {
  return async (req, res, next) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: 'No autenticado' });
      }

      // A01: verificar el rol directamente en BD, nunca confiar en datos del cliente
      const { rows } = await query('SELECT role FROM users WHERE id = $1', [req.session.userId]);
      if (rows.length === 0 || rows[0].role !== role) {
        await logEvent('access_denied', {
          userId: req.session.userId,
          ip: req.ip,
          metadata: { requiredRole: role, path: req.originalUrl }
        });
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}
