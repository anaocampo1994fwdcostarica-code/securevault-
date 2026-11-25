import fs from 'node:fs';
import path from 'node:path';
import { pool } from '../src/db.js';

// Script de migración: ejecuta el SQL del esquema y cierra el pool.
(async () => {
  try {
    const schemaPath = path.join(import.meta.dirname, '..', 'db', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, { encoding: 'utf8' });

    await pool.query(sql);
    console.log('Migración completada');
    await pool.end();
  } catch (err) {
    // No se expone la cadena de conexión ni detalles sensibles
    console.error('Migración fallida:', err.message);
    try { await pool.end(); } catch (_) {}
    process.exit(1);
  }
})();
