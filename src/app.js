import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import { query } from './db.js';
import sessionMiddleware from './session.js';
import authRoutes from './routes/auth.js';
import notesRoutes from './routes/notes.js';
import profileRoutes from './routes/profile.js';
import adminRoutes from './routes/admin.js';

const app = express();

// A02/A07: confiar en el primer proxy en producción para cookies Secure y rate limiting
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by'); // A02: ocultar detalles del framework
app.use(helmet()); // A02: cabeceras de seguridad
// A02/A08: servir archivos estáticos locales sin scripts inline antes de las rutas /api
app.use(express.static(path.join(import.meta.dirname, '..', 'public'), { extensions: ['html'] }));
app.use(express.json({ limit: '10kb' })); // A06: límite de diseño para tamaño de cuerpo
app.use(sessionMiddleware); // A07: sesiones seguras en PostgreSQL

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (e) {
    console.error('Health check falló:', e.message);
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
