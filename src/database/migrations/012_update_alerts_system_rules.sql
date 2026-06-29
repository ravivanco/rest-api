ALTER TABLE alertas_sistema
  ALTER COLUMN id_nutricionista DROP NOT NULL;

ALTER TABLE alertas_sistema
  ADD COLUMN IF NOT EXISTS severidad varchar(10),
  ADD COLUMN IF NOT EXISTS fecha_alerta date,
  ADD COLUMN IF NOT EXISTS datos jsonb;

ALTER TABLE alertas_sistema
  DROP CONSTRAINT IF EXISTS alertas_sistema_severidad_check;

ALTER TABLE alertas_sistema
  ADD CONSTRAINT alertas_sistema_severidad_check
  CHECK (severidad IS NULL OR severidad IN ('normal', 'critica'));

CREATE INDEX IF NOT EXISTS idx_alertas_sistema_abiertas
  ON alertas_sistema (revisada, fecha_generacion DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_sistema_paciente_tipo_fecha
  ON alertas_sistema (id_perfil, tipo, fecha_alerta);
