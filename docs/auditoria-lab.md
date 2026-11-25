# Reporte de Auditoría de Seguridad — SecureVault

**Fecha:** 2026-11-25  
**Alcance:** Revisión estática de código fuente (`src/`, `public/`, `db/`, `scripts/`, configuración raíz).  
**Estados:** `Cumple` / `Parcial` / `Falta` / `Verificar manualmente`

---

## A) Requisitos funcionales

| Requisito | Estado | Evidencia (archivo:línea) | Qué falta |
| :--- | :--- | :--- | :--- |
| **RF-01** Registro con correo, nombre y contraseña con política de complejidad; contraseña solo como hash. | Cumple | `src/validation/auth.js:4-29`, `src/routes/auth.js:61-81`, `src/security/password.js:16-18`, `db/schema.sql:9` | — |
| **RF-02** Login y logout; sesión con cookie HttpOnly, Secure y SameSite; el logout invalida la sesión. | Cumple | `src/routes/auth.js:100-213`, `src/session.js:23-28` | — |
| **RF-03** Roles usuario y administrador; el rol se verifica siempre en el servidor. | Cumple | `db/schema.sql:10`, `src/routes/auth.js:75-78`, `src/middleware/auth.js:18-41`, `src/routes/admin.js:18` | — |
| **RF-04** CRUD de notas; cada usuario solo accede a las suyas; contenido cifrado en la BD. | Cumple | `src/routes/notes.js:14-200`, `db/schema.sql:24` | — |
| **RF-05** Campo sensible (teléfono) cifrado y mostrado enmascarado (`***-***-1234`). | Cumple | `db/schema.sql:12`, `src/routes/profile.js:29-32`, `src/routes/profile.js:56-84` | — |
| **RF-06** Recuperación de contraseña con token aleatorio de un solo uso, con expiración; en la BD solo el hash del token. | Cumple | `src/routes/auth.js:235-343`, `db/schema.sql:38-40` | — |
| **RF-07** Panel admin con lista de usuarios y bitácora de eventos de seguridad (logins fallidos, cambios de rol, accesos denegados). | Cumple | `src/routes/admin.js:21-109`, `src/routes/auth.js:121,162`, `src/middleware/auth.js:28`, `public/js/admin.js:73-208` | — |
| **RF-08** `GET /health` sin revelar versiones ni datos internos. | Cumple | `src/app.js:25-34` | — |

---

## B) OWASP Top 10:2025

| Requisito | Estado | Evidencia (archivo:línea) | Qué falta |
| :--- | :--- | :--- | :--- |
| **A01 Broken Access Control:** middleware de rol, `WHERE owner_id` en cada consulta, denegar por defecto, lista blanca si hay peticiones salientes. | Cumple | `src/middleware/auth.js:7-41`, `src/routes/notes.js:14,22,45,83,149,182`, `src/routes/profile.js:11`, `src/routes/admin.js:18`, `src/app.js:42-44` (sin peticiones HTTP salientes en `src/`) | — |
| **A02 Security Misconfiguration:** `helmet` con CSP, `X-Powered-By` desactivado, CORS restringido, `NODE_ENV=production`, sin stack traces al cliente, sin rutas de depuración. | Parcial | `src/app.js:18-19`, `src/app.js:47-54`, `src/session.js:19` | Falta configuración explícita de CORS restringido; verificar `NODE_ENV=production` y cabeceras en vivo. |
| **A03 Software Supply Chain:** `package-lock.json` presente, uso de `npm ci`, Dependabot o Renovate configurado (`.github/dependabot.yml`), mínimo de dependencias. | Parcial | `package-lock.json` presente, `package.json:25-34` (8 dependencias directas) | Falta `.github/dependabot.yml` y pipeline/guía con `npm ci`. |
| **A04 Cryptographic Failures:** Argon2id para contraseñas, AES-256-GCM con IV aleatorio de 12 bytes por cifrado, llaves fuera del código, cookies Secure. | Cumple | `src/security/password.js:4-18`, `src/security/crypto.js:3-53`, `src/session.js:25`, `src/db.js:11` | — |
| **A05 Injection (incluye XSS):** consultas parametrizadas en TODAS las consultas SQL, validación con `zod`, sin `innerHTML` en el frontend, CSP sin scripts inline. | Cumple | `src/db.js:26-28`, `src/audit.js:33-36`, `src/validation/auth.js:1-68`, `src/validation/notes.js:1-33`, `public/js/api.js:56,82`, `public/js/notes.js:64-85`, `public/js/admin.js:43-57` | — |
| **A06 Insecure Design:** límites de negocio (máximo de notas, tamaño de nota, tamaño del body) y documento de modelo de amenazas (STRIDE o DFD). | Parcial | `src/routes/notes.js:11,49-51` (`MAX_NOTES_PER_USER = 100`), `src/validation/notes.js:10,14`, `src/app.js:22` (`10kb`) | Falta documento de modelo de amenazas (STRIDE o diagrama de flujo de datos). |
| **A07 Authentication Failures:** rate limiting en login (HTTP 429), bloqueo progresivo, mensajes genéricos, regeneración del ID de sesión al autenticar, expiración de sesión. | Cumple | `src/routes/auth.js:18-31,122,135,140-177`, `src/session.js:27` | — |
| **A08 Software or Data Integrity Failures:** sin deserializar datos no confiables, sin CDN (o SRI), pipeline de CI con pruebas antes del deploy (`.github/workflows/*.yml`). | Parcial | `public/*.html` y `public/css/styles.css:1` (sin CDN ni recursos externos), `src/validation/*.js` (Zod `.strict()`) | Falta pipeline de CI en `.github/workflows/*.yml` que ejecute pruebas antes del deploy. |
| **A09 Security Logging and Alerting:** registro de logins, accesos denegados y cambios de rol; sin secretos en logs; formato JSON estructurado (`pino`/`winston`); alerta ante N fallos. | Parcial | `src/audit.js:3-46`, `src/routes/auth.js:121,162,185`, `src/middleware/auth.js:28`, `src/routes/admin.js:99` | Falta logger estructurado JSON (`pino` o `winston`); `src/app.js:48` y `src/audit.js:40` usan `console.*` en texto plano. |
| **A10 Mishandling of Exceptional Conditions:** manejador global genérico, fail closed, `unhandledRejection`, timeouts en BD y peticiones externas. | Cumple | `src/app.js:47-54`, `src/security/crypto.js:94-96`, `src/routes/notes.js:100-108`, `src/server.js:14-22`, `src/db.js:4-15` | — |

---

## C) Criptografía: PROHIBIDO

| Práctica prohibida | Estado | Evidencia (archivo:línea) | Qué falta |
| :--- | :--- | :--- | :--- |
| MD5 o SHA-1/SHA-256 simple para contraseñas | Cumple | No presente; contraseñas usan Argon2id (`src/security/password.js:5-18`) | — |
| AES en modo ECB | Cumple | No presente; se usa `aes-256-gcm` (`src/security/crypto.js:3`) | — |
| `crypto.createCipher()` | Cumple | No presente; se usa `createCipheriv` (`src/security/crypto.js:46`) | — |
| Reutilizar el mismo IV | Cumple | No presente; `randomBytes(IV_LENGTH)` por cifrado (`src/security/crypto.js:45`) | — |
| Llaves escritas en el código | Cumple | No presente; leídas desde `process.env` (`src/security/crypto.js:11,21`, `src/session.js:6,18`) | — |
| `Math.random()` para tokens | Cumple | No presente; se usa `randomBytes(32)` (`src/routes/auth.js:258`, `src/security/password.js:31`) | — |
| Algoritmos propios | Cumple | No presente; usa `node:crypto` y `argon2` | — |
| Contraseñas cifradas en vez de hasheadas | Cumple | No presente; hash Argon2id en `password_hash` (`src/routes/auth.js:72-80`) | — |

---

## D) Entorno de producción

| Requisito | Estado | Evidencia (archivo:línea) | Qué falta |
| :--- | :--- | :--- | :--- |
| `app.set('trust proxy', 1)` en producción | Cumple | `src/app.js:14-16` | — |
| Variables y llaves leídas solo de `process.env` | Cumple | `src/db.js:4,10`, `src/session.js:6,18,25`, `src/security/crypto.js:11,21`, `src/server.js:5` | — |
| Conexión a la BD cifrada (`ssl`) | Cumple | `src/db.js:11` (`ssl: { rejectUnauthorized: true }`) | — |
| Despliegue reproducible (pipeline CI/CD o pasos en README) | Falta | `README.md:1-3` (sin pasos); sin `.github/workflows/` | Pipeline CI/CD y documentación de despliegue en `README.md`. |
| HTTPS, calificación de cabeceras, SSL Labs y `NODE_ENV=production` en vivo | Verificar manualmente | `src/app.js:14,19`, `src/session.js:25` | Comprobar en navegador y herramientas externas sobre la URL de producción. |

---

## E) Entregables

| Requisito | Estado | Evidencia (archivo:línea) | Qué falta |
| :--- | :--- | :--- | :--- |
| `README.md` con descripción, instalación, variables (solo nombres) y despliegue | Falta | `README.md:1-3` | Redactar documentación completa en `README.md`. |
| `.gitignore` que excluya `.env` y `node_modules` | Cumple | `.gitignore:1-4` | — |
| Script `"test"` real en `package.json` | Falta | `package.json:9` (placeholder `exit 1`) | Reemplazar por ejecución real (ej. `node --test`). |
| Carpeta de pruebas automatizadas | Falta | Raíz del proyecto sin carpeta `test/` o `tests/` | Crear carpeta `test/` con pruebas automatizadas. |

---

## PENDIENTES PRIORIZADOS

1. **Pruebas automatizadas y script `"test"` real (Alto impacto en nota — E, A08):** crear la carpeta `test/` con pruebas de autenticación, control de acceso (A01), cifrado/AAD (A04) y validación (A05), y actualizar `"test"` en `package.json` (ej. `"node --test"`).
2. **`README.md` completo con guía de instalación, variables de entorno y despliegue (Alto impacto — D, E):** actualizar `README.md` con descripción, instalación local, lista de variables (solo nombres, sin valores) y pasos reproducibles de despliegue.
3. **Pipeline de CI/CD y Dependabot (Medio-Alto impacto — A03, A08, D):** crear `.github/workflows/ci.yml` (usando `npm ci` y `npm test` antes del deploy) y `.github/dependabot.yml` para actualizaciones de seguridad.
4. **Documento de modelo de amenazas STRIDE / DFD (Medio impacto — A06):** crear `docs/threat-model.md` documentando activos, actores, flujos de datos y mitigaciones STRIDE.
5. **Logger estructurado JSON (Medio impacto — A09):** incorporar `pino` (o `winston`) en un módulo dedicado (ej. `src/logger.js`) y reemplazar `console.error`/`console.warn` en `src/app.js`, `src/audit.js`, `src/db.js` y `src/server.js`.
6. **Configuración explícita de CORS (Bajo-Medio impacto — A02):** definir una política explícita de orígenes permitidos en `src/app.js` (si aplica acceso desde otros orígenes o para reforzar la postura por defecto).
7. **Verificación manual en producción (Obligatorio antes de entrega):** comprobar en el servidor desplegado que `NODE_ENV=production` esté activo, que la cookie `sv.sid` lleve `Secure`, `HttpOnly`, `SameSite=Strict`, y validar cabeceras/TLS en navegador y SSL Labs.

---

## Resumen de cumplimiento

| Estado | Cantidad |
| :--- | :---: |
| **Cumple** | 25 |
| **Parcial** | 5 |
| **Falta** | 4 |
| **Verificar manualmente** | 1 |
| **Total evaluado** | **35** |
