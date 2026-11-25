-- Extensión para funciones criptográficas (pgcrypto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  -- A04: el teléfono se almacena con cifrado AES-256-GCM para proteger datos sensibles
  phone_enc text,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabla de notas
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  -- A04: el contenido se guarda con cifrado AES-256-GCM para evitar exposición de datos
  content_enc text NOT NULL,
  key_version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas por propietario
CREATE INDEX IF NOT EXISTS idx_notes_owner_id ON notes(owner_id);

-- Tabla de tokens de reseteo de contraseña
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- A04: se guarda SHA-256 del token, no el token
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  event text NOT NULL,
  user_id uuid,
  ip text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
