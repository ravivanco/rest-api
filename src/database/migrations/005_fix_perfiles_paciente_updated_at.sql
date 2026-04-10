-- Migracion 005: Corregir trigger set_updated_at en perfiles_paciente
-- Causa raiz del 500 en onboarding:
--   record "new" has no field "updated_at" (SQLSTATE 42703)
-- porque existe trigger BEFORE UPDATE usando set_updated_at(),
-- pero la tabla perfiles_paciente no tenia columna updated_at.

BEGIN;

ALTER TABLE perfiles_paciente
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN perfiles_paciente.updated_at IS
  'Timestamp de ultima actualizacion automatica por trigger set_updated_at';

COMMIT;
