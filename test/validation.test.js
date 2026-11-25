import { test, describe, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';

let registerSchema, loginSchema, noteSchema, idSchema, phoneSchema;

before(async () => {
  const auth = await import('../src/validation/auth.js');
  const notes = await import('../src/validation/notes.js');
  registerSchema = auth.registerSchema;
  loginSchema = auth.loginSchema;
  noteSchema = notes.noteSchema;
  idSchema = notes.idSchema;
  phoneSchema = notes.phoneSchema;
});

describe('Validation schemas', () => {
  test('registerSchema rejects extra fields', () => {
    const extra = { email: '  USER@Example.COM  ', name: 'Juan', password: 'Clave-1234!', role: 'admin' };
    const resultExtra = registerSchema.safeParse(extra);
    assert.ok(!resultExtra.success, 'Extra fields should be rejected (strict)');
  });

  test('registerSchema rejects weak passwords', () => {
    const weakCases = [
      { reason: 'sin mayúscula', data: { email: 'test@example.com', name: 'Ana', password: 'clave-segura-2026' } },
      { reason: 'sin número', data: { email: 'test@example.com', name: 'Ana', password: 'Clave-Segura-Abc' } },
      { reason: 'sin símbolo', data: { email: 'test@example.com', name: 'Ana', password: 'ClaveSegura2026' } },
      { reason: 'corta', data: { email: 'test@example.com', name: 'Ana', password: 'Ab1!' } }
    ];
    for (const { reason, data } of weakCases) {
      const result = registerSchema.safeParse(data);
      assert.ok(!result.success, `Weak password (${reason}) should be rejected`);
    }
  });

  test('registerSchema normalizes email and accepts strong password', () => {
    const good = { email: '  USER@Example.COM  ', name: 'Ana', password: 'ClaveSegura-2026!' };
    const resultGood = registerSchema.safeParse(good);
    assert.ok(resultGood.success, 'Valid registration should pass');
    assert.equal(resultGood.data.email, 'user@example.com');
  });

  test('loginSchema rejects malicious email injection', () => {
    const malicious = { email: "' OR 1=1 --", password: 'something' };
    const result = loginSchema.safeParse(malicious);
    assert.ok(!result.success, 'Malicious email should be rejected');
  });

  test('noteSchema enforces size limits but allows raw HTML content', () => {
    const longTitle = 'a'.repeat(121);
    const resultTitle = noteSchema.safeParse({ title: longTitle, content: 'ok' });
    assert.ok(!resultTitle.success, 'Title exceeding limit should be rejected');

    const longContent = 'b'.repeat(5001);
    const resultContent = noteSchema.safeParse({ title: 'ok', content: longContent });
    assert.ok(!resultContent.success, 'Content exceeding limit should be rejected');

    const htmlNote = { title: 'HTML', content: '<script>alert(1)</script>' };
    const resultHtml = noteSchema.safeParse(htmlNote);
    assert.ok(resultHtml.success, 'HTML content should be accepted (stored as text)');
  });

  test('idSchema validates UUID and rejects non‑UUID strings', () => {
    const bad = '1 OR 1=1';
    const resultBad = idSchema.safeParse(bad);
    assert.ok(!resultBad.success, 'Injection string should be rejected');

    const good = randomUUID();
    const resultGood = idSchema.safeParse(good);
    assert.ok(resultGood.success, 'Valid UUID should be accepted');
  });

  test('phoneSchema normalizes and validates phone numbers', () => {
    const raw = { phone: '8888-1234' };
    const result = phoneSchema.safeParse(raw);
    assert.ok(result.success, 'Phone should be accepted');
    assert.equal(result.data.phone, '88881234');

    const bad = { phone: 'abc' };
    const resultBad = phoneSchema.safeParse(bad);
    assert.ok(!resultBad.success, 'Invalid phone should be rejected');
  });
});
