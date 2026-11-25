import { z } from 'zod';

// A05/A07: esquema estricto de registro con normalización y política de contraseñas (validación de entrada previene inyección)
export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, 'El correo no puede superar 254 caracteres')
      .email('Correo electrónico inválido'),
    name: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(80, 'El nombre no puede superar 80 caracteres'),
    password: z
      .string()
      .min(12, 'La contraseña debe tener al menos 12 caracteres')
      .max(128, 'La contraseña no puede superar 128 caracteres')
      .regex(/[A-Z]/, 'La contraseña debe incluir al menos una mayúscula')
      .regex(/[a-z]/, 'La contraseña debe incluir al menos una minúscula')
      .regex(/[0-9]/, 'La contraseña debe incluir al menos un número')
      .regex(/[^A-Za-z0-9]/, 'La contraseña debe incluir al menos un símbolo')
  })
  .strict(); // A01: rechaza campos extra no permitidos (ej. role)

// A05/A01: esquema estricto de inicio de sesión (validación de entrada previene inyección)
export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, 'El correo no puede superar 254 caracteres')
      .email('Correo electrónico inválido'),
    password: z
      .string()
      .min(1, 'La contraseña es requerida')
      .max(128, 'La contraseña no puede superar 128 caracteres')
  })
  .strict(); // A01: rechaza campos extra no permitidos
