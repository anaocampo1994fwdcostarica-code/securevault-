import { query, pool } from '../src/db.js';
const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) { console.error('Uso: node --env-file=.env scripts/unlock-user.js correo@ejemplo.com'); process.exit(1); }
const { rows } = await query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE email = $1 RETURNING email', [email]);
console.log(rows.length ? `Desbloqueado: ${rows[0].email}` : 'No existe un usuario con ese correo');
await pool.end();
