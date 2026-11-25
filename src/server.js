import app from './app.js';
import { createServer } from 'node:http';
import process from 'node:process';

const port = process.env.PORT || 3000;

const server = createServer(app);

server.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});

// Manejo de errores inesperados – A10: fallar de forma segura
process.on('unhandledRejection', (reason) => {
  console.error('Rechazo no manejado:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
  process.exit(1);
});
