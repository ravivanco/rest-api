-- Migración 002: Agregar foto de perfil a perfiles_paciente
-- Fecha: 2026-04-05
-- Autor: tu nombre

ALTER TABLE perfiles_paciente
ADD COLUMN IF NOT EXISTS foto_perfil_url TEXT;

COMMENT ON COLUMN perfiles_paciente.foto_perfil_url IS 'URL de la foto de perfil del paciente';