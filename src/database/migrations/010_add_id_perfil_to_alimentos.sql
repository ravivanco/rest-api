-- Migración 010: Agregar columna id_perfil a la tabla alimentos para soportar alimentos personalizados.
-- Fecha: 2026-05-24

ALTER TABLE alimentos
ADD COLUMN IF NOT EXISTS id_perfil INTEGER REFERENCES perfiles_paciente(id_perfil) ON DELETE CASCADE DEFAULT NULL;

COMMENT ON COLUMN alimentos.id_perfil IS 'ID del perfil del paciente al que pertenece este alimento personalizado. Si es NULL, es un alimento global de catálogo.';
