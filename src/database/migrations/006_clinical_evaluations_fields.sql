-- Migracion 006: Actualizacion de esquema para Evaluaciones Clinicas
-- Objetivo: Soportar nuevas metricas historicas

BEGIN;

ALTER TABLE evaluaciones_clinicas
  ADD COLUMN IF NOT EXISTS agua_corporal_pct NUMERIC(5,2) DEFAULT NULL CHECK (agua_corporal_pct >= 0 AND agua_corporal_pct <= 100),
  ADD COLUMN IF NOT EXISTS masa_osea_kg      NUMERIC(5,2) DEFAULT NULL CHECK (masa_osea_kg >= 0),
  ADD COLUMN IF NOT EXISTS grasa_visceral    NUMERIC(5,2) DEFAULT NULL CHECK (grasa_visceral >= 0),
  ADD COLUMN IF NOT EXISTS tmb_kcal          NUMERIC(6,2) DEFAULT NULL CHECK (tmb_kcal > 0);

-- Indices para busquedas eficientes de historiales clinicos y rendimiento del Dashboard
CREATE INDEX IF NOT EXISTS idx_eval_perfil_historial ON evaluaciones_clinicas (id_perfil, fecha_evaluacion DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eval_nutricionista ON evaluaciones_clinicas (id_nutricionista);

COMMIT;
