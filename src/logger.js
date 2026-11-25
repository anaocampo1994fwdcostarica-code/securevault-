import pino from 'pino';

// A09: logs en JSON estructurado; los campos sensibles se ocultan aunque se pasen por error
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'password',
      '*.password',
      'token',
      '*.token',
      'req.headers.cookie',
      'req.headers.authorization',
      'DATABASE_URL',
      'DATA_ENCRYPTION_KEY',
      'SESSION_SECRET'
    ],
    censor: '[REDACTADO]'
  },
  base: { app: 'securevault' }, // sin hostname ni pid
});
