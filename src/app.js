import path from 'node:path';
import { logger } from './logger.js';
import express from 'express';
import helmet from 'helmet';
import { query } from './db.js';
import sessionMiddleware from './session.js';
import authRoutes from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import profileRoutes from './routes/profile.js';
import adminRoutes from './routes/admin.js';

const app = express();

// A02/A07: confiar SOLO en proxies conocidos para obtener la IP real del cliente.
// Cadena en producción: cliente -> Cloudflare -> proxy interno de Render (10.x) -> app.
// No usar 'true': permitiría falsificar X-Forwarded-For y saltarse el rate limit.
const TRUSTED_PROXIES = [
  'loopback', 'linklocal', 'uniquelocal', // redes internas (10.x de Render)
  // Rangos oficiales de Cloudflare: https://www.cloudflare.com/ips/
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32'
];
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', TRUSTED_PROXIES);
}

app.disable('x-powered-by'); // A02: ocultar detalles del framework
app.use(helmet()); 
// A02: la app no usa estas APIs del navegador; se bloquean para cualquier script
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});
// A02: cabeceras de seguridad
// A02/A08: servir archivos estáticos locales sin scripts inline antes de las rutas /api
app.use(express.static(path.join(import.meta.dirname, '..', 'public'), { extensions: ['html'] }));
app.use(express.json({ limit: '10kb' })); // A06: límite de diseño para tamaño de cuerpo
app.use(sessionMiddleware); // A07: sesiones seguras en PostgreSQL

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (e) {
    logger.error({ err: e.message }, 'Health check falló');
    // RF-08: no revelar detalles del error
    res.status(503).json({ status: 'degraded' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);

// Manejador 404 – A02: no revelar información
app.use((req, res) => {
  res.status(404).json({ error: 'No encontrado' });
});

// Manejador global de errores – A10: fallar de forma segura sin stack trace
app.use((err, req, res, next) => {
  console.error(`Error en ${req.method} ${req.originalUrl}:`, err.message);
  const status = err.status || err.statusCode;
  if (status >= 400 && status <= 499) {
    return res.status(status).json({ error: 'Solicitud inválida' });
  }
  return res.status(500).json({ error: 'Error interno' });
});

export default app;
