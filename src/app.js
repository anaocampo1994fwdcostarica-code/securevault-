import express from 'express';
import helmet from 'helmet';
import { query } from './db.js';

const app = express();

app.disable('x-powered-by'); // A02: hide framework details
app.use(helmet()); // A06: security headers
app.use(express.json({ limit: '10kb' })); // A03: limit request size

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (e) {
    // RF-08: no leak of error details
    res.status(503).json({ status: 'degraded' });
  }
});

// 404 handler – A01 generic response
app.use((req, res) => {
  res.status(404).json({ error: 'No encontrado' });
});

export default app;
