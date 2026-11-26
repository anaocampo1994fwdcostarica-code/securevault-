import { logger } from './logger.js';
import { query } from './db.js';

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'token_hash',
  'phone_enc',
  'content_enc',
  'secret'
]);

/**
 * Registra un evento de auditoría en audit_logs.
 * A09: nunca almacena contraseñas, tokens ni datos cifrados.
 * @param {string} event - Nombre del evento.
 * @param {object} [options] - Opciones del evento.
 * @param {string|null} [options.userId=null] - ID del usuario relacionado.
 * @param {string|null} [options.ip=null] - Dirección IP del cliente.
 * @param {object} [options.metadata={}] - Metadatos adicionales no sensibles.
 */
export async function logEvent(event, { userId = null, ip = null, metadata = {} } = {}) {
  try {
    const safeMetadata = {};
    if (metadata && typeof metadata === 'object') {
      for (const [key, value] of Object.entries(metadata)) {
        if (!SENSITIVE_KEYS.has(key.toLowerCase())) {
          safeMetadata[key] = value;
        }
      }
    }

    await query(
      'INSERT INTO audit_logs (event, user_id, ip, metadata) VALUES ($1, $2, $3, $4)',
      [event, userId, ip, JSON.stringify(safeMetadata)]
    );

    // A09: alerta simple en consola ante eventos de fuerza bruta o bloqueo
    if (event === 'account_locked' || event === 'login_rate_limited') {
      logger.warn({ event, ip, alerta: true }, 'ALERTA DE SEGURIDAD');
    }
  } catch (err) {
    // A09/A10: registrar fallo de auditoría en consola sin interrumpir la petición
    logger.error({ err: err.message }, 'Error al registrar evento de auditoria');
  }
}
