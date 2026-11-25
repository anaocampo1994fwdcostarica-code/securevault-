import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

// A04/A10: cargar y validar llaves de cifrado al iniciar el módulo (fallar de forma segura)
function loadKeys() {
  const keys = {};

  const rawV1 = process.env.DATA_ENCRYPTION_KEY;
  if (!rawV1) {
    throw new Error('Llave de cifrado inválida');
  }
  const keyV1 = Buffer.from(rawV1, 'base64');
  if (keyV1.length !== 32) {
    throw new Error('Llave de cifrado inválida');
  }
  keys[1] = keyV1;

  if (process.env.DATA_ENCRYPTION_KEY_V2) {
    const keyV2 = Buffer.from(process.env.DATA_ENCRYPTION_KEY_V2, 'base64');
    if (keyV2.length !== 32) {
      throw new Error('Llave de cifrado inválida');
    }
    keys[2] = keyV2;
  }

  return keys;
}

const KEYS = loadKeys();
export const CURRENT_KEY_VERSION = Math.max(...Object.keys(KEYS).map(Number));

/**
 * Cifra texto plano usando AES-256-GCM con IV único y AAD (A04).
 * El AAD liga el texto cifrado a su dueño, para que nadie pueda copiar el contenido
 * cifrado de una nota de otro usuario a la suya.
 * @param {string} plaintext - Texto a cifrar.
 * @param {string} aad - Datos autenticados adicionales (ej. ID del dueño).
 * @returns {string} Cadena con formato "v{version}.{iv_base64}.{tag_base64}.{datos_base64}".
 */
export function encrypt(plaintext, aad) {
  const key = KEYS[CURRENT_KEY_VERSION];
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  cipher.setAAD(Buffer.from(String(aad)));

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v${CURRENT_KEY_VERSION}.${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

/**
 * Descifra una carga útil generada con encrypt() validando su integridad y AAD (A04).
 * El AAD liga el texto cifrado a su dueño, para que nadie pueda copiar el contenido
 * cifrado de una nota de otro usuario a la suya.
 * @param {string} payload - Texto cifrado con formato versionado.
 * @param {string} aad - Datos autenticados adicionales (debe coincidir con el de encrypt).
 * @returns {string} Texto plano original.
 */
export function decrypt(payload, aad) {
  try {
    if (typeof payload !== 'string') {
      throw new Error('No se pudo descifrar');
    }

    const parts = payload.split('.');
    if (parts.length !== 4 || !parts[0].startsWith('v')) {
      throw new Error('No se pudo descifrar');
    }

    const version = Number(parts[0].slice(1));
    const key = KEYS[version];
    if (!Number.isInteger(version) || !key) {
      throw new Error('No se pudo descifrar');
    }

    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const ciphertext = Buffer.from(parts[3], 'base64');

    if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
      throw new Error('No se pudo descifrar');
    }

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAAD(Buffer.from(String(aad)));
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // A10: no exponer detalles criptográficos al fallar el descifrado
    throw new Error('No se pudo descifrar');
  }
}
