import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id, // A04: algoritmo resistente a fuerza bruta con GPU/ASIC
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
};

/**
 * Genera el hash Argon2id de una contraseña en texto plano (A04).
 * @param {string} plain - Contraseña en texto plano.
 * @returns {Promise<string>} Hash Argon2id.
 */
export async function hashPassword(plain) {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

/**
 * Verifica una contraseña contra su hash Argon2id (A04/A07).
 * @param {string} hash - Hash almacenado.
 * @param {string} plain - Contraseña proporcionada.
 * @returns {Promise<boolean>} True si coincide.
 */
export async function verifyPassword(hash, plain) {
  return argon2.verify(hash, plain);
}

// A07: hash ficticio precalculado para igualar tiempos de respuesta y evitar enumeración de usuarios
export const DUMMY_HASH = await hashPassword(randomBytes(32).toString('hex'));
