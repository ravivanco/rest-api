CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.unaccent($1);
$$;

CREATE INDEX IF NOT EXISTS idx_alimentos_detalle_categoria
  ON alimentos_detalle (categoria);

CREATE INDEX IF NOT EXISTS idx_alimentos_detalle_nombre_unaccent_trgm
  ON alimentos_detalle
  USING gin (immutable_unaccent(lower(nombre)) gin_trgm_ops);