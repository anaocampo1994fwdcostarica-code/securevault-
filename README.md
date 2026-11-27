# SecureVault

Aplicación web para guardar notas privadas y datos personales sensibles, desarrollada como laboratorio de seguridad sobre el **OWASP Top 10:2025**. El contenido de las notas y el teléfono se guardan cifrados con AES-256-GCM, las contraseñas con Argon2id, y la aplicación se publica en producción con HTTPS.

## Funcionalidades

| Código | Requisito |
| --- | --- |
| RF-01 | Registro con correo, nombre y contraseña con política de complejidad. La contraseña se guarda solo como hash Argon2id. |
| RF-02 | Inicio y cierre de sesión. Cookie `HttpOnly`, `Secure` (en producción) y `SameSite=Strict`, con expiración de 30 minutos. El cierre de sesión destruye la sesión en el servidor. |
| RF-03 | Roles `user` y `admin`. El rol se verifica siempre en el servidor, consultando la base de datos. |
| RF-04 | CRUD de notas. Cada usuario accede solo a sus notas; el contenido se guarda cifrado con AES-256-GCM. |
| RF-05 | Teléfono cifrado con AES-256-GCM y mostrado enmascarado (`***-***-1234`). |
| RF-06 | Recuperación de contraseña con token aleatorio de un solo uso que expira en 15 minutos. En la base de datos solo se guarda el hash SHA-256 del token. |
| RF-07 | Panel de administración con la lista de usuarios, cambio de rol y bitácora de eventos de seguridad. |
| RF-08 | `GET /health` responde el estado sin revelar versiones ni datos internos. |

## Stack

Node.js 24 · Express 5 · PostgreSQL (Neon) · `pg` · `argon2` · `helmet` · `express-rate-limit` · `express-session` + `connect-pg-simple` · `zod` · `pino`. Frontend en HTML, CSS y JavaScript sin frameworks ni recursos externos.

## Controles de seguridad

| OWASP Top 10:2025 | Medida implementada | Dónde |
| --- | --- | --- |
| A01 Broken Access Control | `requireAuth` y `requireRole` (rol leído de la BD); toda consulta de notas filtra por `owner_id` de la sesión; un acceso ajeno responde 404 y queda en la bitácora | `src/middleware/auth.js`, `src/routes/notes.js` |
| A02 Security Misconfiguration | `helmet` con CSP, `x-powered-by` desactivado, errores genéricos sin stack trace, CORS limitado al mismo origen (no se habilitan orígenes externos); Permissions-Policy (cámara, micrófono, ubicación, pagos y USB deshabilitados); `trust proxy` con lista explícita de proxies de Render y Cloudflare (no `true`). Calificación A en securityheaders.com | `src/app.js` |
| A03 Software Supply Chain Failures | `package-lock.json` versionado, instalación con `npm ci`, `npm audit` en CI, Dependabot semanal | `.github/workflows/ci.yml`, `.github/dependabot.yml` |
| A04 Cryptographic Failures | Argon2id (m=19456, t=2, p=1); AES-256-GCM con IV aleatorio de 12 bytes, tag de 16 bytes, AAD ligado al dueño y versión de llave; llaves solo en variables de entorno; TLS con `verify-full` hacia la BD | `src/security/password.js`, `src/security/crypto.js`, `src/db.js` |
| A05 Injection | Consultas parametrizadas (`$1`, `$2`) en todo el acceso a datos; validación con `zod` y `.strict()`; el frontend muestra datos solo con `textContent`, sin `innerHTML` ni scripts inline | `src/db.js`, `src/validation/`, `public/js/` |
| A06 Insecure Design | Límites de negocio: 100 notas por usuario, título de 120 y contenido de 5000 caracteres, cuerpo de 10 KB; modelo de amenazas STRIDE | `src/routes/notes.js`, `src/validation/notes.js`, `docs/threat-model.md` |
| A07 Authentication Failures | Rate limiting en login (429), bloqueo de cuenta 15 minutos tras 5 fallos, mensajes genéricos, comparación con hash señuelo para igualar tiempos, regeneración del ID de sesión al iniciar sesión | `src/routes/auth.js`, `src/session.js` |
| A08 Software or Data Integrity Failures | Pipeline de CI que ejecuta pruebas y auditoría en cada push y pull request; código a `main` solo por pull request; sin scripts de CDN; escaneo de secretos con gitleaks en CI | `.github/workflows/ci.yml`, `public/` |
| A09 Security Logging and Alerting Failures | Bitácora `audit_logs` (logins, fallos, bloqueos, accesos denegados, cambios de rol) sin contraseñas ni tokens; logs JSON con `pino` y redacción de campos sensibles; alerta ante bloqueo o rate limit | `src/audit.js`, `src/logger.js` |
| A10 Mishandling of Exceptional Conditions | Manejador global de errores con respuesta genérica; si el descifrado falla, la petición falla cerrada; manejo de `unhandledRejection` y `uncaughtException`; timeouts de conexión y de consulta en la BD | `src/app.js`, `src/server.js`, `src/db.js` |

## Instalación local

Requisitos: Node.js 24 o superior y una base de datos PostgreSQL (por ejemplo, un proyecto gratuito en Neon).

```bash
git clone https://github.com/anaocampo1994fwdcostarica-code/securevault-.git
cd securevault-
npm ci
cp .env.example .env
```

Genera las llaves y cópialas en `.env` (nunca las subas al repositorio):

```bash
# DATA_ENCRYPTION_KEY: 32 bytes
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# SESSION_SECRET: 48 bytes
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Crea las tablas y arranca el servidor en `http://localhost:3000`:

```bash
npm run db:migrate
npm run dev
```

## Variables de entorno

Solo se documentan los nombres. Los valores reales viven en `.env` (local) o en el panel de la plataforma (producción).

| Variable | Descripción |
| --- | --- |
| `NODE_ENV` | `development` o `production`. En producción activa cookies `Secure` y `trust proxy`. |
| `PORT` | Puerto HTTP. Por defecto 3000; Render lo asigna automáticamente. |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL con `sslmode=verify-full`. |
| `DATA_ENCRYPTION_KEY` | Llave AES-256 de 32 bytes en base64 (versión 1). |
| `DATA_ENCRYPTION_KEY_V2` | Opcional. Segunda llave para rotación; si existe, cifra todo lo nuevo. |
| `SESSION_SECRET` | Secreto para firmar la cookie de sesión. |
| `LOG_LEVEL` | Opcional. Nivel de `pino` (`info` por defecto). |

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga automática, leyendo `.env`. |
| `npm start` | Servidor de producción (`node src/server.js`). |
| `npm test` | Pruebas automatizadas con `node:test`. |
| `npm run db:migrate` | Crea las tablas definidas en `db/schema.sql`. |
| `npm run make-admin -- correo@ejemplo.com` | Convierte un usuario existente en administrador. |
| `node --env-file=.env scripts/unlock-user.js correo@ejemplo.com` | Desbloquea una cuenta bloqueada por intentos fallidos. |
| `node --env-file=.env scripts/rotate-key.js --dry-run` | Cuenta los registros que se re-cifrarían, sin escribir nada. |
| `node --env-file=.env scripts/rotate-key.js` | Re-cifra notas y teléfonos con la llave más nueva. |

El primer administrador se crea siempre con `make-admin` desde una terminal con acceso a la base de datos. No existe ningún endpoint público para asignar roles de administrador a uno mismo.

## Rotación de llaves

1. Generar una llave nueva: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
2. Configurarla como `DATA_ENCRYPTION_KEY_V2` (en `.env` o en el panel de Render), **sin quitar** `DATA_ENCRYPTION_KEY` (v1). Desde ese momento todo lo nuevo se cifra con la v2.
3. Ejecutar `node --env-file=.env scripts/rotate-key.js --dry-run` para ver cuántos registros se re-cifrarían.
4. Ejecutar `node --env-file=.env scripts/rotate-key.js` para re-cifrarlos. El script solo imprime conteos y deja intacto cualquier registro que no pueda descifrar.
5. Verificar que las notas y los teléfonos se leen correctamente en la aplicación y que el script reporta 0 errores.
6. Solo entonces retirar la llave v1 (conservando un respaldo en el gestor de contraseñas).

## Pruebas e integración continua

- `npm test` ejecuta 18 pruebas sobre cifrado (formato, IV único, AAD, detección de manipulación), hash de contraseñas y validación de entradas. No necesitan base de datos ni secretos.
- `.github/workflows/ci.yml` corre en cada push a `main` y `ana` y en cada pull request hacia `main`: `npm ci`, `npm test` y `npm audit --audit-level=high`, con permisos de solo lectura. Un segundo job (`secretos`) revisa todo el historial con gitleaks.
- `.github/dependabot.yml` revisa cada semana las dependencias de npm y las acciones de GitHub.

## Despliegue en producción (Render + Neon)

**URL de producción:** https://securevault-m0xr.onrender.com

1. Crear un proyecto **nuevo** en Neon para producción, separado del de desarrollo.
2. Crear localmente `.env.production` con `NODE_ENV=production`, la cadena de Neon de producción y llaves **nuevas** (no reutilizar las de desarrollo). El archivo está excluido por `.gitignore`.
3. Respaldar `DATA_ENCRYPTION_KEY` de producción en un gestor de contraseñas: si se pierde, los datos cifrados son irrecuperables.
4. Crear las tablas: `node --env-file=.env.production scripts/migrate.js`
5. En Render, crear un **Web Service** conectado a la rama `main`: Build Command `npm ci`, Start Command `npm start`, plan Free, región Ohio y Health Check Path `/health`.
6. Cargar en *Environment* las variables `NODE_ENV`, `DATABASE_URL`, `DATA_ENCRYPTION_KEY` y `SESSION_SECRET`.
7. Registrar la cuenta del administrador desde la web y promoverla: `node --env-file=.env.production scripts/make-admin.js correo@ejemplo.com`
8. Verificar que `http://` redirige a `https://`, que `/health` responde `{"status":"ok"}` y que la cookie `sv.sid` tiene `HttpOnly`, `Secure` y `SameSite=Strict`.

Cada merge a `main` vuelve a desplegar automáticamente, y Render reinicia el proceso si `/health` deja de responder.

## Credenciales de prueba

Se entregan al docente por canal privado.
