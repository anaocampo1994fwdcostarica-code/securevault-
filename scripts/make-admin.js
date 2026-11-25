import { query, pool } from '../src/db.js';
const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) { console.error('Uso: npm run make-admin -- correo@ejemplo.com'); process.exit(1); }
const { rows } = await query("UPDATE users SET role = 'admin' WHERE email = $1 RETURNING email, role", [email]);
console.log(rows.length ? rows[0] : 'No existe un usuario con ese correo');
await pool.end();
