-- Migracion 003: Seed de catalogos minimos para onboarding
-- Ejecutar en produccion para garantizar que el flujo movil pueda mapear IDs.

BEGIN;

-- 1) Condiciones medicas base con IDs estables usados por la app movil
INSERT INTO condiciones_medicas (id_condicion, nombre, descripcion, activo)
VALUES
  (1, 'Diabetes', 'Diabetes mellitus', TRUE),
  (2, 'Hipertension', 'Hipertension arterial', TRUE),
  (3, 'Hipotiroidismo', 'Disfuncion tiroidea', TRUE),
  (4, 'Resistencia', 'Resistencia a la insulina', TRUE),
  (5, 'Ninguna', 'Sin condicion medica reportada', TRUE)
ON CONFLICT (id_condicion) DO NOTHING;

-- Ajustar secuencia para evitar colisiones futuras de IDs autoincrementales
SELECT setval(
  pg_get_serial_sequence('condiciones_medicas', 'id_condicion'),
  GREATEST((SELECT COALESCE(MAX(id_condicion), 1) FROM condiciones_medicas), 1)
);

-- 2) Alimentos base requeridos por el onboarding movil
-- Inserta solo si el alimento aun no existe por nombre.
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
    ('Huevos',     'proteinas',      155,  1.1, 13.0, 11.0, NULL, NULL, TRUE),
    ('Pavo',       'proteinas',      135,  0.0, 29.0, 1.0, NULL, NULL, TRUE),
    ('Legumbres',  'carbohidratos',  116, 20.0,  9.0, 0.4, NULL, NULL, TRUE),
    ('Arroz',      'carbohidratos',  130, 28.0,  2.7, 0.3, NULL, NULL, TRUE),
    ('Pan',        'carbohidratos',  265, 49.0,  9.0, 3.2, NULL, NULL, TRUE),
    ('Pasta',      'carbohidratos',  131, 25.0,  5.0, 1.1, NULL, NULL, TRUE),
    ('Quinoa',     'carbohidratos',  120, 21.0,  4.4, 1.9, NULL, NULL, TRUE),
    ('Avena',      'carbohidratos',  389, 66.0, 17.0, 7.0, NULL, NULL, TRUE),
    ('Papas',      'carbohidratos',   77, 17.0,  2.0, 0.1, NULL, NULL, TRUE),
    ('Batata',     'carbohidratos',   86, 20.0,  1.6, 0.1, NULL, NULL, TRUE),
    ('Yogur',      'lacteos',         59,  3.6, 10.0, 0.4, NULL, NULL, TRUE),
    ('Queso',      'lacteos',        402,  1.3, 25.0, 33.0, NULL, NULL, TRUE),
    ('Brocoli',    'vegetales',       34,  6.6,  2.8, 0.4, NULL, NULL, TRUE),
    ('Zanahoria',  'vegetales',       41, 10.0,  0.9, 0.2, NULL, NULL, TRUE),
    ('Espinaca',   'vegetales',       23,  3.6,  2.9, 0.4, NULL, NULL, TRUE),
    ('Lechuga',    'vegetales',       15,  2.9,  1.4, 0.2, NULL, NULL, TRUE),
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

COMMIT;
