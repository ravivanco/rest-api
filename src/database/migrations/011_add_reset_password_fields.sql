-- Migración 011: Agregar columnas de recuperación de contraseña para la tabla usuarios.
-- Fecha: 2026-06-03

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS reset_code VARCHAR(6) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN usuarios.reset_code IS 'Código temporal de 6 dígitos para restablecer la contraseña';
COMMENT ON COLUMN usuarios.reset_code_expires IS 'Fecha y hora de expiración del código de restablecimiento';
