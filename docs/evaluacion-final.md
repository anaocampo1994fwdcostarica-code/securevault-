# Evaluación Final de Laboratorio — SecureVault

**Rol:** Docente evaluador  
**Proyecto:** SecureVault (Node.js 24, Express 5, PostgreSQL)  
**Criterio estricto:** Todo punto marcado como cumplido cita archivo y línea exacta del código fuente. Lo que depende de ejecución en vivo o herramientas externas se marca como **Evidencia manual requerida**.

---

## 1. Tabla de la Rúbrica (100 puntos)

| Criterio | Puntos máximos | Puntaje estimado | Nivel | Justificación con citas |
| :--- | :---: | :---: | :--- | :--- |
| **1. Deep Research de despliegue** | 10 | Evaluación externa | Evaluación externa | No forma parte del repositorio; debe evaluarse en el documento de investigación entregado por el estudiante. |
| **2. Funcionalidad RF-01 a RF-08** | 10 | 10 / 10 | Excelente | Todos los requisitos están implementados en el código:<br>• **RF-01:** Registro con validación de complejidad (`src/validation/auth.js:4-29`) y hash Argon2id (`src/routes/auth.js:61-81`, `src/security/password.js:16-18`).<br>• **RF-02:** Login/logout (`src/routes/auth.js:100-213`) con cookie `sv.sid` `HttpOnly`, `Secure` en producción y `SameSite=strict` (`src/session.js:19-28`).<br>• **RF-03:** Roles `user`/`admin` verificados en BD mediante `requireRole` (`src/middleware/auth.js:18-40`).<br>• **RF-04:** CRUD de notas propias con cifrado AES-256-GCM (`src/routes/notes.js:17-200`).<br>• **RF-05:** Teléfono cifrado en `PUT /api/profile/phone` y enmascarado `***-***-XXXX` en `GET /api/profile` (`src/routes/profile.js:14-84`).<br>• **RF-06:** Recuperación con token aleatorio de un solo uso, expiración de 15 min y hash SHA-256 en BD (`src/routes/auth.js:235-343`).<br>• **RF-07:** Panel admin para listar usuarios, cambiar rol y consultar bitácora (`src/routes/admin.js:18-110`, `public/js/admin.js:73-208`).<br>• **RF-08:** Endpoint `GET /health` sin datos internos (`src/app.js:44-53`). |
| **3. OWASP Top 10:2025** | 30 | 28 / 30 *(sujeto a evidencia manual)* | Excelente | Las 10 categorías tienen mitigaciones verificables en el código (ver Sección 2). Se descuentan 2 puntos por la alerta de seguridad rota en `src/audit.js:40` (`logger` no está importado en `src/audit.js:1`, provocando `ReferenceError` capturado en `src/audit.js:42-44`) y porque la verificación en vivo depende de las evidencias manuales listadas. |
| **4. Hash y cifrado** | 20 | 20 / 20 | Excelente | Argon2id con `m=19456, t=2, p=1` (`src/security/password.js:4-18`). AES-256-GCM con IV aleatorio de 12 bytes y authTag de 16 bytes por cifrado (`src/security/crypto.js:3-5,43-53`). Llaves cargadas solo desde variables de entorno (`src/security/crypto.js:11-27`) y excluidas de Git (`.gitignore:2-4`). Análisis de pérdida y rotación documentado (`docs/threat-model.md:87-97`). **Cero prácticas prohibidas** detectadas en `src/` y `public/`. |
| **5. Despliegue a producción** | 20 | 10 / 20 *(+10 pts sujetos a evidencia manual)* | Aceptable *(en repo)* | Verificable en código: `trust proxy` limitado a Cloudflare/Render (`src/app.js:17-29`), TLS `rejectUnauthorized: true` en BD (`src/db.js:11`), health check `/health` (`src/app.js:44-53`), CI en `.github/workflows/ci.yml:1-37` y guía de despliegue en `README.md:97-108`. HTTPS en vivo, gestión de secretos en Render, BD Neon en producción y reinicio automático requieren **Evidencia manual requerida**. |
| **6. Informe y demostración** | 10 | 6 / 10 *(+4 pts sujetos a evidencia manual)* | Aceptable *(en repo)* | `README.md:1-112` y `docs/threat-model.md:1-108` están claros, estructurados y declaran riesgos residuales (`docs/threat-model.md:99-108`), aunque `README.md:87` referencia un script inexistente (`scripts/unlock-user.js`). La demostración en vivo y el informe final de seguridad son **Evidencia manual requerida**. |

---

## 2. Tabla OWASP Top 10:2025 (A01 a A10)

| Categoría | Mitigación (archivo:línea) | Evidencia que debe presentar el estudiante |
| :--- | :--- | :--- |
| **A01 Broken Access Control** | `requireAuth` y `requireRole` consultan rol en BD (`src/middleware/auth.js:7-40`). Consultas de notas filtran por `owner_id = $2` y devuelven `404` + `access_denied` (`src/routes/notes.js:80-94,143-161,180-194`). Registro fuerza `role = 'user'` (`src/routes/auth.js:75-77`) y Zod `.strict()` rechaza campos extra (`src/validation/auth.js:29`). | Captura o salida HTTP donde el usuario A intenta leer (`GET`), editar (`PUT`) o borrar (`DELETE`) una nota del usuario B y recibe `404` (o `403` en rutas `/api/admin/*`), más el registro `access_denied` en la bitácora. |
| **A02 Security Misconfiguration** | `app.disable('x-powered-by')` (`src/app.js:31`), `helmet()` (`src/app.js:32`), `Permissions-Policy` (`src/app.js:34-37`), `trust proxy` restringido (`src/app.js:17-29`), CORS sin orígenes externos habilitados y cookie `sv.sid` (`src/session.js:19`). | Captura del reporte de **securityheaders.com** sobre la URL de producción con calificación **A** o superior. |
| **A03 Software Supply Chain Failures** | `package-lock.json` presente, CI usa `npm ci` y `npm audit --audit-level=high` (`.github/workflows/ci.yml:28-37`), Dependabot semanal para `npm` y `github-actions` (`.github/dependabot.yml:1-16`). | Captura o salida de `npm audit` sin vulnerabilidades altas/críticas y captura de la configuración/alertas de Dependabot en GitHub. |
| **A04 Cryptographic Failures** | Argon2id (`src/security/password.js:4-18`), AES-256-GCM con IV único de 12 bytes, tag de 16 bytes y AAD ligado al dueño (`src/security/crypto.js:3-5,43-53`), SHA-256 para tokens (`src/routes/auth.js:259,300`), TLS `rejectUnauthorized: true` hacia BD (`src/db.js:11`). | Captura de la BD (Neon) mostrando `password_hash` con prefijo `$argon2id$` y `content_enc`/`phone_enc` cifrados con prefijo `v1.`, más captura de **SSL Labs** sobre el dominio en producción. |
| **A05 Injection** | Consultas SQL parametrizadas `$1, $2` (`src/db.js:26-28` y todas las rutas), validación estricta con Zod (`src/validation/auth.js:4-68`, `src/validation/notes.js:4-33`), frontend manipula DOM solo con `textContent` y `createElement` sin `innerHTML` (`public/js/notes.js:61-87`, `public/js/admin.js:43-57`). | Captura enviando `' OR 1=1 --` (rechazado por Zod / parametrización sin error SQL) y `<script>alert(1)</script>` en una nota (guardado y mostrado como texto plano sin ejecutarse). |
| **A06 Insecure Design** | Límite de 100 notas por usuario (`src/routes/notes.js:11,49-51`), longitudes máximas en título/contenido (`src/validation/notes.js:10,14`), JSON máx. 10 KB (`src/app.js:41`), modelo de amenazas STRIDE y casos de abuso (`docs/threat-model.md:28-85`). | Diagrama de flujo de datos, tabla STRIDE y tabla de mitigaciones/riesgos residuales presentes en `docs/threat-model.md`. |
| **A07 Authentication Failures** | `loginLimiter` (5 intentos/15 min -> `429`) y bloqueo de cuenta 15 min (`src/routes/auth.js:18-31,128-167`), `DUMMY_HASH` contra enumeración (`src/routes/auth.js:120,129`, `src/security/password.js:31`), `req.session.regenerate` (`src/routes/auth.js:177`), cierre de sesiones al resetear contraseña o cambiar rol (`src/routes/auth.js:329-332`, `src/routes/admin.js:93-96`). | Captura de prueba de fuerza bruta sobre `/api/auth/login` mostrando respuestas `401` iniciales y bloqueo con HTTP `429` tras superar el límite. |
| **A08 Software or Data Integrity Failures** | Pipeline CI en `.github/workflows/ci.yml:1-37` (`npm ci`, `npm test`, `npm audit`) con permisos `contents: read`; cero scripts externos o CDN en `public/*.html` (ej. `public/notes.html:7-10`). | Captura de ejecución exitosa del workflow `CI de seguridad` en GitHub Actions y justificación de no usar CDN (activos locales sin SRI necesario). |
| **A09 Security Logging and Alerting Failures** | Bitácora `audit_logs` filtrando llaves sensibles (`src/audit.js:3-36`), logs JSON con `pino` y `redact` (`src/logger.js:4-21`), panel de bitácora (`src/routes/admin.js:35-53`, `public/js/admin.js:161-208`). *Nota: la alerta en `src/audit.js:40` falla por falta de import.* | Muestra de logs JSON emitidos por `pino` (con campos sensibles redactados) y captura de la vista del panel de administración mostrando la bitácora de auditoría. |
| **A10 Mishandling of Exceptional Conditions** | Manejador global de errores sin stack trace (`src/app.js:66-73`), fallo cerrado en `decrypt` (`src/security/crypto.js:94-97`, `src/routes/notes.js:98-108`), timeouts de BD (`src/db.js:12-14`), captura de `unhandledRejection`/`uncaughtException` (`src/server.js:14-22`). | Captura de prueba forzando un error (ej. payload alterado en BD o JSON malformado) que muestre respuesta genérica al cliente (`500 Error interno` / `400 Solicitud inválida`) junto con el detalle en el log interno del servidor. |

---

## 3. Tabla de Bonificación (hasta +10 pts)

| Extra evaluado | Estado | Puntos | Evidencia / Cita |
| :--- | :---: | :---: | :--- |
| **MFA con TOTP** | No implementado | +0 | No existe ninguna librería TOTP en `package.json:25-35` ni flujo MFA en `src/routes/auth.js`. Confirmado en `docs/threat-model.md:107`. |
| **Rotación de llaves implementada (campo de versión y varias llaves)** | **Cumple** | +2 | `src/security/crypto.js:21-33,74-78` soporta `DATA_ENCRYPTION_KEY` (v1) y `DATA_ENCRYPTION_KEY_V2` (v2) seleccionando `CURRENT_KEY_VERSION` para cifrar y la versión del prefijo `vN.` para descifrar; `db/schema.sql:25` define `key_version int NOT NULL DEFAULT 1` en `notes`, y `src/routes/notes.js:57,60,147,151` lo persiste. |
| **Contenedor Docker con usuario no root** | No implementado | +0 | No existe `Dockerfile` en el repositorio. |
| **Escaneo de secretos en CI (`gitleaks` u otro)** | No implementado | +0 | `.github/workflows/ci.yml:17-37` solo ejecuta `checkout`, `setup-node`, `npm ci`, `npm test` y `npm audit`. |
| **Alertas enviadas a un canal externo** | No implementado | +0 | `src/audit.js:39-41` solo intenta log local (y falla por `logger` no importado); no hay integración con webhook, Slack o correo. |
| **Total Bonificación** | — | **+2 / +10** | — |

---

## 4. Tabla del Checklist de Entrega (Sección 10 del Lab)

| Ítem del checklist | Estado | Cita verificable |
| :--- | :--- | :--- |
| `.env` fuera del historial (verifica `.gitignore`) | **Cumple** *(en `.gitignore`)* / **Evidencia manual** *(historial git)* | `.gitignore:2-4` excluye `.env` y `.env.*` (permitiendo `!.env.example`). El historial de commits no se verificó por restricción de no ejecutar `git`. |
| `npm audit` sin altas ni críticas | **Evidencia manual** | Configurado en `.github/workflows/ci.yml:36-37`, pero la salida real de `npm audit` no se ejecutó por restricción de no correr `npm`. |
| Un usuario no puede ver, editar ni borrar notas de otro | **Cumple** | `src/routes/notes.js:83,149,182` exige `WHERE id = $... AND owner_id = $...` y retorna `404` + `access_denied` en las tres operaciones. |
| Contraseñas que empiezan con `$argon2id$` | **Cumple** *(en código)* / **Evidencia manual** *(en BD)* | `src/security/password.js:5,17` usa `argon2.argon2id`; requiere captura de la tabla `users` en BD. |
| Contenido de notas ilegible en la BD | **Cumple** *(en código)* / **Evidencia manual** *(en BD)* | `src/routes/notes.js:54,141` cifra con `encrypt(content, ownerId)` (`aes-256-gcm` en `src/security/crypto.js:3,43-53`); requiere captura de `notes.content_enc` en BD. |
| Solo HTTPS y cookies `HttpOnly`, `Secure` y `SameSite` | **Cumple** *(en código)* / **Evidencia manual** *(en vivo)* | `src/session.js:23-27` configura `httpOnly: true`, `secure: process.env.NODE_ENV === 'production'`, `sameSite: 'strict'`; requiere captura de DevTools/headers en producción. |
| Errores genéricos con detalle solo en logs | **Cumple** | `src/app.js:66-73` devuelve `'Solicitud inválida'` o `'Error interno'` y registra `err.message` en el servidor. |
| Login devuelve `429` tras varios intentos | **Cumple** *(en código)* / **Evidencia manual** *(en vivo)* | `src/routes/auth.js:18-30` configura `limit: 5` y responde `429`. |
| Logs sin contraseñas, tokens ni datos sensibles | **Cumple** | `src/logger.js:6-19` redacta `password`, `token`, cookies, `DATABASE_URL`, `DATA_ENCRYPTION_KEY`, `SESSION_SECRET`; `src/audit.js:3-11,26-31` filtra `SENSITIVE_KEYS`. |
| `README` que explica cómo reproducir el despliegue | **Cumple** | `README.md:97-108` detalla los 8 pasos para desplegar en Neon + Render. |

---

## 5. LISTA DE EVIDENCIAS MANUALES

El estudiante debe adjuntar al informe las siguientes capturas numeradas:

1. **Reporte de `securityheaders.com`** sobre la URL pública de producción mostrando calificación **A** o superior (A02).
2. **Reporte de SSL Labs** sobre el dominio en producción validando TLS/HTTPS (A04 / Despliegue).
3. **Captura de DevTools (Network / Application -> Cookies)** en producción mostrando redirección a `https://` y la cookie `sv.sid` con atributos `HttpOnly`, `Secure` y `SameSite=Strict` (RF-02 / Checklist).
4. **Salida de `npm audit --audit-level=high`** (local o en GitHub Actions) demostrando 0 vulnerabilidades altas o críticas, junto con captura de la ejecución verde del workflow `CI de seguridad` y Dependabot (A03 / A08).
5. **Captura de la base de datos en Neon** mostrando la tabla `users` (`password_hash` iniciando con `$argon2id$` y `phone_enc` cifrado `v1.`) y la tabla `notes` (`content_enc` ilegible con formato `v1.<iv>.<tag>.<datos>`) (A04 / RF-04 / RF-05).
6. **Captura de prueba IDOR (A01)**: usuario A intentando `GET`, `PUT` y `DELETE` sobre el ID de una nota del usuario B y recibiendo `404 No encontrado`, más el evento `access_denied` en la bitácora.
7. **Captura de pruebas de inyección (A05)**: intento de `' OR 1=1 --` rechazado limpiamente y creación/lectura de nota con `<script>alert(1)</script>` mostrada como texto sin ejecución.
8. **Captura de prueba de fuerza bruta (A07)**: intentos fallidos a `/api/auth/login` devolviendo `401` y luego HTTP `429` al superar el límite, además de la IP real del cliente reflejada en `audit_logs`.
9. **Muestra de logs JSON (`pino`)** en consola/Render (incluyendo redacción de secretos y detalle interno de un error forzado) junto con la respuesta genérica `500 Error interno` vista por el cliente (A09 / A10).
10. **Captura del panel de administración (`/admin.html`)** mostrando la lista de usuarios, cambio de rol y tabla de bitácora de auditoría (RF-07 / A09).
11. **Capturas del panel de Render y Neon**: variables de entorno cargadas sin exponerse en el repo, health check `/health` respondiendo `{"status":"ok"}` y configuración de auto-deploy/reinicio automático (Despliegue).
12. **Demostración funcional en vivo** (video o recorrido presencial de RF-01 a RF-08) e **informe final de seguridad / Deep Research** (Criterios 1 y 6).

---

## 6. RIESGOS O DEBILIDADES

Ordenados de mayor a menor gravedad:

1. **[ALTO] Error en alerta de seguridad (`src/audit.js:40`):** `src/audit.js` invoca `logger.warn(...)` cuando ocurren eventos `account_locked` o `login_rate_limited`, pero **no importa `logger`** en `src/audit.js:1`. Esto lanza `ReferenceError: logger is not defined` en tiempo de ejecución (silenciado por el `catch` en `src/audit.js:42-44`), rompiendo la alerta de fuerza bruta de A09.
2. **[MEDIO] Documentación de script inexistente (`README.md:87`):** El `README.md` documenta el comando `node --env-file=.env scripts/unlock-user.js correo@ejemplo.com`, pero el archivo `scripts/unlock-user.js` **no existe** en la carpeta `scripts/` (solo existen `make-admin.js` y `migrate.js`).
3. **[MEDIO] Logs mezclados fuera de `pino` (`src/app.js:67`, `src/db.js:17`, `src/audit.js:44`, `src/server.js:10,15,20`):** Varios módulos usan `console.log`/`console.error` en lugar de `logger` (`pino`), por lo que esos errores no se emiten en formato JSON estructurado ni pasan por la política de redacción de `src/logger.js:6-19`.
4. **[MEDIO] Recuperación de contraseña sin proveedor de correo en producción (`src/routes/auth.js:274-276`):** En desarrollo el enlace se imprime con `console.log` y puerto fijo `3000`; en producción no existe envío de correo, haciendo inusable RF-06 en vivo sin acceso a BD (`docs/threat-model.md:106`).
5. **[BAJO] Rate limiter en memoria (`src/routes/auth.js:18-58`):** Al no usar un almacén compartido (como PostgreSQL o Redis), los contadores se reinician al reiniciar el contenedor y no escalan a múltiples instancias (`docs/threat-model.md:105`).
6. **[BAJO] Tabla `users` sin columna `key_version` para `phone_enc` (`db/schema.sql:12`):** Aunque el payload cifrado incluye el prefijo `v1.`/`v2.` y permite descifrar (`src/security/crypto.js:70-75`), la ausencia de columna `key_version` en `users` dificulta auditar o migrar teléfonos durante una rotación masiva de llaves sin escanear todos los registros.

---

## 7. Puntaje Total Estimado

- **Puntaje verificable directamente en el repositorio:** **74 / 100** (`10` RF-01..RF-08 + `28` OWASP Top 10 + `20` Hash y cifrado + `10` Despliegue en código + `6` Documentación en repo).
- **Puntos pendientes de evidencia manual y evaluación externa:** **24 pts** (`10` pts Deep Research externo + `10` pts Despliegue en vivo + `4` pts Demo e informe final), además de la validación práctica de las capturas OWASP (A01–A10).
- **Bonificación verificable:** **+2 / +10** (rotación de llaves con versión implementada).
- **Total estimado:** **76 / 100** verificables hoy en el repositorio (`74` base + `2` bonificación). Si las evidencias manuales y el Deep Research externo resultan satisfactorios, el proyecto alcanzaría hasta **98 / 100 + 2 de bonificación (100 / 100)**.
