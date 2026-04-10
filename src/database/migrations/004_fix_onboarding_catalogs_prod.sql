-- Migracion 004: Correcciones de catalogo para onboarding en produccion
-- Objetivo:
-- 1) Asegurar condiciones medicas base activas
-- 2) Poblar alimentos minimos para mapear IDs desde app movil
-- 3) Evitar catalogo vacio en /foods y /patient-profile/options

BEGIN;

-- ============================================================
-- 1) Condiciones medicas base (upsert por nombre)
-- ============================================================

INSERT INTO condiciones_medicas (nombre, descripcion, activo)
VALUES
  ('Diabetes',               'Diabetes mellitus tipo 2', TRUE),
  ('Hipertension',           'Hipertension arterial', TRUE),
  ('Hipotiroidismo',         'Funcion tiroidea reducida', TRUE),
  ('Resistencia a insulina', 'Resistencia periferica a la insulina', TRUE),
  ('Ninguna',                'Sin condiciones medicas diagnosticadas', TRUE)
ON CONFLICT (nombre) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    activo      = TRUE;

-- Reactivar tambien la variante con tilde si existe en este entorno
UPDATE condiciones_medicas
SET activo = TRUE
WHERE nombre IN ('Hipertension', 'Hipertensión');

-- ============================================================
-- 2) Alimentos base para onboarding (sin duplicar)
-- ============================================================

INSERT INTO alimentos (
  nombre,
  categoria,
  calorias_por_100g,
  carbohidratos_g,
  proteinas_g,
  grasas_g,
  vitaminas,
  minerales,
  activo
)
SELECT * FROM (
  VALUES
    ('Pollo',      'proteinas',      165,  0.0, 31.0, 3.6, NULL, NULL, TRUE),
    ('Res',        'proteinas',      250,  0.0, 26.0, 15.0, NULL, NULL, TRUE),
    ('Pescado',    'proteinas',      206,  0.0, 22.0, 12.0, NULL, NULL, TRUE),
    ('Atun',       'proteinas',      132,  0.0, 28.0, 1.0, NULL, NULL, TRUE),
    ('Legumbres',  'carbohidratos',  116, 20.0,  9.0, 0.4, NULL, NULL, TRUE),
    ('Huevos',     'proteinas',      155,  1.1, 13.0, 11.0, NULL, NULL, TRUE),
    ('Pavo',       'proteinas',      135,  0.0, 29.0, 1.0, NULL, NULL, TRUE),
    ('Arroz',      'carbohidratos',  130, 28.0,  2.7, 0.3, NULL, NULL, TRUE),
    ('Pan',        'carbohidratos',  265, 49.0,  9.0, 3.2, NULL, NULL, TRUE),
    ('Pasta',      'carbohidratos',  131, 25.0,  5.0, 1.1, NULL, NULL, TRUE),
    ('Quinoa',     'carbohidratos',  120, 21.0,  4.4, 1.9, NULL, NULL, TRUE),
    ('Avena',      'carbohidratos',  389, 66.0, 17.0, 7.0, NULL, NULL, TRUE),
    ('Papas',      'carbohidratos',   77, 17.0,  2.0, 0.1, NULL, NULL, TRUE),
    ('Batata',     'carbohidratos',   86, 20.0,  1.6, 0.1, NULL, NULL, TRUE),
    ('Yogur',      'lacteos',         59,  3.6, 10.0, 0.4, NULL, NULL, TRUE),
    ('Queso',      'lacteos',        402,  1.3, 25.0, 33.0, NULL, NULL, TRUE),
    ('Crema',      'lacteos',        340,  2.9,  2.0, 36.0, NULL, NULL, TRUE),
    ('Mantequilla','grasas',         717,  0.1,  0.9, 81.0, NULL, NULL, TRUE),
    ('Cuajada',    'lacteos',         98,  3.4, 11.1, 4.3, NULL, NULL, TRUE),
    ('Requeson',   'lacteos',         98,  3.4, 11.1, 4.3, NULL, NULL, TRUE),
    ('Brocoli',    'vegetales',       34,  6.6,  2.8, 0.4, NULL, NULL, TRUE),
    ('Zanahoria',  'vegetales',       41, 10.0,  0.9, 0.2, NULL, NULL, TRUE),
    ('Espinaca',   'vegetales',       23,  3.6,  2.9, 0.4, NULL, NULL, TRUE),
    ('Lechuga',    'vegetales',       15,  2.9,  1.4, 0.2, NULL, NULL, TRUE),
    ('Pimientos',  'vegetales',       31,  6.0,  1.0, 0.3, NULL, NULL, TRUE),
    ('Cebolla',    'vegetales',       40,  9.3,  1.1, 0.1, NULL, NULL, TRUE),
    ('Manzana',    'frutas',          52, 14.0,  0.3, 0.2, NULL, NULL, TRUE),
    ('Banana',     'frutas',          89, 23.0,  1.1, 0.3, NULL, NULL, TRUE),
    ('Naranja',    'frutas',          47, 12.0,  0.9, 0.1, NULL, NULL, TRUE),
    ('Sandia',     'frutas',          30,  8.0,  0.6, 0.2, NULL, NULL, TRUE),
    ('Fresas',     'frutas',          33,  8.0,  0.7, 0.3, NULL, NULL, TRUE),
    ('Uvas',       'frutas',          69, 18.0,  0.7, 0.2, NULL, NULL, TRUE),
    ('Arandanos',  'frutas',          57, 14.0,  0.7, 0.3, NULL, NULL, TRUE)
) AS seed(
  nombre,
  categoria,
  calorias_por_100g,
  carbohidratos_g,
  proteinas_g,
  grasas_g,
  vitaminas,
  minerales,
  activo
)
WHERE NOT EXISTS (
  SELECT 1
  FROM alimentos a
  WHERE LOWER(a.nombre) = LOWER(seed.nombre)
);

-- Reactivar alimentos base si estaban inactivos
UPDATE alimentos
SET activo = TRUE,
    updated_at = NOW()
WHERE LOWER(nombre) IN (
  'pollo','res','pescado','atun','legumbres','huevos','pavo',
  'arroz','pan','pasta','quinoa','avena','papas','batata',
  'yogur','queso','crema','mantequilla','cuajada','requeson',
  'brocoli','zanahoria','espinaca','lechuga','pimientos','cebolla',
  'manzana','banana','naranja','sandia','fresas','uvas','arandanos'
);

-- ============================================================
-- 3) Validaciones de seguridad
-- ============================================================

DO $$
DECLARE
  v_food_count INTEGER;
  v_cond_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_food_count
  FROM alimentos
  WHERE activo = TRUE;

  SELECT COUNT(*) INTO v_cond_count
  FROM condiciones_medicas
  WHERE activo = TRUE;

  IF v_food_count = 0 THEN
    RAISE EXCEPTION 'Catalogo de alimentos sigue vacio tras migracion';
  END IF;

  IF v_cond_count = 0 THEN
    RAISE EXCEPTION 'Catalogo de condiciones sigue vacio tras migracion';
  END IF;

  RAISE NOTICE 'OK 004: alimentos activos=% | condiciones activas=%', v_food_count, v_cond_count;
END $$;

COMMIT;
