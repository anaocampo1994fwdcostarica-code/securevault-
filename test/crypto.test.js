import { test, describe, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';

let encrypt, decrypt;

before(async () => {
  // A04: generar clave aleatoria para el módulo de cifrado
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  // Carga dinámica después de establecer la variable de entorno
  const cryptoModule = await import('../src/security/crypto.js');
  encrypt = cryptoModule.encrypt;
  decrypt = cryptoModule.decrypt;
});

describe('Crypto module', () => {
  const plaintext = 'Mensaje confidencial';
  const aad = 'usuario-123';

  test('encrypt and decrypt round‑trip', () => {
    const payload = encrypt(plaintext, aad);
    const decrypted = decrypt(payload, aad);
    assert.equal(decrypted, plaintext);
  });

  test('payload format and component sizes', () => {
    const payload = encrypt(plaintext, aad);
    const parts = payload.split('.');
    assert.equal(parts.length, 4, 'Formato debe ser v{version}.iv.tag.cipher');
    const version = parts[0];
    assert.match(version, /^v\d+$/);
    const iv = Buffer.from(parts[1], 'base64');
    const tag = Buffer.from(parts[2], 'base64');
    const data = Buffer.from(parts[3], 'base64');
    assert.equal(iv.length, 12, 'IV debe ser 12 bytes');
    assert.equal(tag.length, 16, 'Tag debe ser 16 bytes');
    assert.ok(data.length > 0, 'Datos cifrados no deben estar vacíos');
  });

  test('IV uniqueness produces different ciphertexts', () => {
    const payload1 = encrypt(plaintext, aad);
    const payload2 = encrypt(plaintext, aad);
    assert.notEqual(payload1, payload2, 'Dos cifrados diferentes deben producir payloads distintos');
  });

  test('decryption fails with incorrect AAD', () => {
    const payload = encrypt(plaintext, aad);
    assert.throws(() => decrypt(payload, 'otro-aad'), /No se pudo descifrar/);
  });

  test('tampering detection throws error', () => {
    const payload = encrypt(plaintext, aad);
    const parts = payload.split('.');
    const dataBuf = Buffer.from(parts[3], 'base64');
    dataBuf[0] ^= 0xff;
    parts[3] = dataBuf.toString('base64');
    const corrupted = parts.join('.');
    assert.throws(() => decrypt(corrupted, aad), /No se pudo descifrar/);
  });

  test('invalid format strings throw error', () => {
    assert.throws(() => decrypt('invalidformat', aad), /No se pudo descifrar/);
    const good = encrypt(plaintext, aad);
    const missing = good.split('.').slice(0, 3).join('.');
    assert.throws(() => decrypt(missing, aad), /No se pudo descifrar/);
  });

  test('unsupported version throws error', () => {
    const payload = encrypt(plaintext, aad);
    const parts = payload.split('.');
    parts[0] = 'v9';
    const badVersion = parts.join('.');
    assert.throws(() => decrypt(badVersion, aad), /No se pudo descifrar/);
  });
});
