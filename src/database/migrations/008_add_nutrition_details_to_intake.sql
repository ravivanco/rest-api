-- Migración: Agregar campos nutricionales detallados a consumos adicionales
ALTER TABLE consumos_adicionales
  ADD COLUMN porcion_g INT NULL,
  ADD COLUMN proteinas_g INT NULL,
  ADD COLUMN carbohidratos_g INT NULL,
  ADD COLUMN grasas_g INT NULL,
  ADD COLUMN confianza_pct INT NULL,
  ADD COLUMN fuente_estimacion VARCHAR(50) NULL,
  ADD COLUMN mensaje TEXT NULL,
  ADD COLUMN alimentos_detectados JSONB NULL;
