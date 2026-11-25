import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db.js';

// A10: fallar de forma segura si no existe el secreto de sesión
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET no configurada');
}

const PgSession = connectPgSimple(session);

// A02/A07: gestión segura de sesiones persistentes en PostgreSQL
const sessionMiddleware = session({
  store: new PgSession({
    pool,
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  name: 'sv.sid', // A02: ocultar tecnología evitando el nombre por defecto connect.sid
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true, // A07: inaccesible desde JavaScript del navegador
    secure: process.env.NODE_ENV === 'production', // A04/A07: solo HTTPS en producción
    sameSite: 'strict', // A07: mitigación contra CSRF
    maxAge: 30 * 60 * 1000 // A07: expiración de 30 minutos
  }
});

export { sessionMiddleware };
export default sessionMiddleware;
