import { test, describe, before } from 'node:test';
import { strict as assert } from 'node:assert';

let hashPassword, verifyPassword, DUMMY_HASH;

before(async () => {
  const passwordModule = await import('../src/security/password.js');
  hashPassword = passwordModule.hashPassword;
  verifyPassword = passwordModule.verifyPassword;
  DUMMY_HASH = passwordModule.DUMMY_HASH;
});

describe('Password hashing module', () => {
  const plain = 'ClaveSegura-2026!';

  test('hashPassword returns Argon2id hash with correct parameters', async () => {
    const hash = await hashPassword(plain);
    assert.ok(hash.startsWith('$argon2id$'), 'Debe iniciar con $argon2id$');
    assert.match(hash, /m=19456,t=2,p=1/, 'Debe contener los parámetros de Argon2id especificados');
  });

  test('Two hashes of the same password differ (random salt)', async () => {
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);
    assert.notEqual(hash1, hash2, 'Los hashes deben ser diferentes debido al salt aleatorio');
  });

  test('verifyPassword succeeds for correct password and fails for wrong one', async () => {
    const hash = await hashPassword(plain);
    const ok = await verifyPassword(hash, plain);
    const bad = await verifyPassword(hash, 'Incorrecta');
    assert.ok(ok, 'La verificación debe ser verdadera con la contraseña correcta');
    assert.ok(!bad, 'La verificación debe ser falsa con una contraseña incorrecta');
  });

  test('DUMMY_HASH is defined and looks like a Argon2id hash', () => {
    assert.ok(typeof DUMMY_HASH === 'string' && DUMMY_HASH.length > 0, 'DUMMY_HASH debe estar definido');
    assert.ok(DUMMY_HASH.startsWith('$argon2id$'), 'DUMMY_HASH debe iniciar con $argon2id$');
  });
});
