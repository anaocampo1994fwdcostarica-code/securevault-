import express from 'express';
import helmet from 'helmet';
import { query } from './db.js';

const app = express();

app.disable('x-powered-by'); // A02: ocultar detalles del framework
app.use(helmet()); // A02: cabeceras de seguridad
app.use(express.json({ limit: '10kb' })); // A06: límite de diseño para tamaño de cuerpo

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

// Manejador 404 – A02: no revelar información
app.use((req, res) => {
  res.status(404).json({ error: 'No encontrado' });
});

// Manejador global de errores – A10: fallar de forma segura sin stack trace
app.use((err, req, res, next) => {
  console.error('Error interno:', err);
  res.status(500).json({ error: 'Error interno' });
});

export default app;
