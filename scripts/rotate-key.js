// A04: rotación de llaves sin pérdida de datos
// Re-cifra notas y teléfonos con la llave más nueva (CURRENT_KEY_VERSION).
// Uso: node --env-file=.env scripts/rotate-key.js [--dry-run]
import { query, pool } from '../src/db.js';
import { encrypt, decrypt, CURRENT_KEY_VERSION } from '../src/security/crypto.js';

// A04: sin una segunda llave no hay nada a qué rotar
if (CURRENT_KEY_VERSION === 1) {
  console.error('Configura DATA_ENCRYPTION_KEY_V2 antes de rotar');
  await pool.end();
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
// Prefijo de la versión actual; se pasa como parámetro, nunca concatenado en el SQL (A05)
const prefijoActual = `v${CURRENT_KEY_VERSION}.%`;

const conteo = { notas: 0, telefonos: 0, errores: 0 };

// A04: actualiza un registro dentro de su propia transacción
async function actualizarEnTransaccion(sql, params) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql, params);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Notas: AAD = id del dueño
const { rows: notas } = await query(
  'SELECT id, owner_id, content_enc FROM notes WHERE content_enc NOT LIKE $1',
  [prefijoActual]
);

for (const nota of notas) {
  if (dryRun) {
    conteo.notas++;
    continue;
  }
  try {
    const texto = decrypt(nota.content_enc, nota.owner_id);
    const nuevo = encrypt(texto, nota.owner_id);
    await actualizarEnTransaccion(
      'UPDATE notes SET content_enc = $1, key_version = $2 WHERE id = $3',
      [nuevo, CURRENT_KEY_VERSION, nota.id]
    );
    conteo.notas++;
  } catch {
    // A10: fallar cerrado por registro; no se modifica y se continúa
    conteo.errores++;
  }
}

// Teléfonos: AAD = id del usuario
const { rows: usuarios } = await query(
  'SELECT id, phone_enc FROM users WHERE phone_enc IS NOT NULL AND phone_enc NOT LIKE $1',
  [prefijoActual]
);

for (const usuario of usuarios) {
  if (dryRun) {
    conteo.telefonos++;
    continue;
  }
  try {
    const texto = decrypt(usuario.phone_enc, usuario.id);
    const nuevo = encrypt(texto, usuario.id);
    await actualizarEnTransaccion(
      'UPDATE users SET phone_enc = $1 WHERE id = $2',
      [nuevo, usuario.id]
    );
    conteo.telefonos++;
  } catch {
    // A10: fallar cerrado por registro; no se modifica y se continúa
    conteo.errores++;
  }
}

// A09: solo conteos; nunca texto descifrado, llaves ni contenido cifrado
const modo = dryRun ? ' (dry-run, sin cambios)' : '';
console.log(`Llave actual: v${CURRENT_KEY_VERSION}${modo}`);
console.log(`Notas ${dryRun ? 'a re-cifrar' : 're-cifradas'}: ${conteo.notas}`);
console.log(`Teléfonos ${dryRun ? 'a re-cifrar' : 're-cifrados'}: ${conteo.telefonos}`);
console.log(`Errores: ${conteo.errores}`);

await pool.end();
if (conteo.errores > 0) process.exitCode = 1;
