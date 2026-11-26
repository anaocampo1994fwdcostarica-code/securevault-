import { logger } from './logger.js';
import app from './app.js';
import { createServer } from 'node:http';
import process from 'node:process';

const port = process.env.PORT || 3000;

const server = createServer(app);

server.listen(port, () => {
  logger.info({ port }, 'Servidor escuchando');
});

// Manejo de errores inesperados – A10: fallar de forma segura
process.on('unhandledRejection', (reason) => {
  logger.error({ err: String(reason) }, 'Rechazo no manejado');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Excepcion no capturada');
  process.exit(1);
});
