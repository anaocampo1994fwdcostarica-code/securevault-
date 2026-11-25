import { z } from 'zod';

// A05/A06: validación estricta para creación y actualización de notas
export const noteSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'El título es requerido')
      .max(120, 'El título no puede superar 120 caracteres'),
    content: z
      .string()
      .min(1, 'El contenido es requerido')
      .max(5000, 'El contenido no puede superar 5000 caracteres')
  })
  .strict(); // A01: rechaza campos extra no permitidos

// A05: validación de identificadores UUID
export const idSchema = z.string().uuid('Identificador inválido');

// A05/A06: validación estricta de teléfono (permite espacios o guiones y los elimina antes de validar)
export const phoneSchema = z
  .object({
    phone: z
      .string()
      .transform((val) => val.replace(/[\s-]/g, ''))
      .pipe(
        z
          .string()
          .regex(/^\d{8,15}$/, 'El teléfono debe contener entre 8 y 15 dígitos')
      )
  })
  .strict(); // A01: rechaza campos extra no permitidos
