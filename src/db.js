import { logger } from './logger.js';
import { Pool } from 'pg';

// A10: fallar de forma segura si falta la cadena de conexión
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no configurada');
}

// Pool de conexiones a PostgreSQL (A04: TLS obligatorio)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }, // A04: asegura canal encriptado
  connectionTimeoutMillis: 5000,      // A10: tiempo máximo para conectar
  idleTimeoutMillis: 30000,          // A10: tiempo máximo de inactividad
  statement_timeout: 5000            // A10: límite de ejecución de consultas
});

pool.on('error', (err) => logger.error({ err: err.message }, 'Error inesperado en el pool de BD'));

/**
 * Ejecuta una consulta parametrizada.
 * Siempre se usan placeholders $1, $2… (A05: previene inyección SQL).
 * @param {string} text - Texto SQL con placeholders.
 * @param {Array} params - Parámetros a sustituir.
 * @returns {Promise<import('pg').QueryResult>} Resultado de la consulta.
 */
export const query = (text, params) => {
  return pool.query(text, params);
};

export { pool };
