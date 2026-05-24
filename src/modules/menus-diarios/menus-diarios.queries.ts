export const GET_MENU_DIARIO_BY_ID = `
SELECT
  md.id_menu_diario,
  dp.dia_semana,
  dp.fecha,
  tc.nombre AS tiempo_comida,
  p.id_plato,
  p.nombre,
  p.descripcion,
  p.calorias_totales,
  p.tiempo_preparacion_min,
  p.modo_preparacion,
  p.generado_por_ia,
  md.calorias_aportadas
FROM menus_diarios md
JOIN dias_plan dp ON dp.id_dia_plan = md.id_dia_plan
JOIN tiempos_comida tc ON tc.id_tiempo_comida = md.id_tiempo_comida
JOIN platos p ON p.id_plato = md.id_plato
WHERE md.id_menu_diario = $1
`;

export const GET_INGREDIENTES_MENU = `
SELECT
  COALESCE(ad.nombre, al.nombre) AS nombre,
  pi.cantidad_g,
  ROUND((COALESCE(ad.calorias, al.calorias_por_100g) * pi.cantidad_g / 100)::numeric, 0)::integer
    AS calorias_aportadas
FROM plato_ingredientes pi
LEFT JOIN alimentos_detalle ad ON ad.id_alimento_detalle = pi.id_alimento_detalle
LEFT JOIN alimentos al ON al.id_alimento = pi.id_alimento
WHERE pi.id_plato = $1
  AND (pi.id_alimento_detalle IS NOT NULL OR pi.id_alimento IS NOT NULL)
`;

export const GET_MENU_REPLACE_CONTEXT = `
SELECT
  md.id_menu_diario,
  md.id_dia_plan,
  md.id_tiempo_comida,
  md.id_plato AS id_plato_anterior,
  md.calorias_aportadas AS calorias_anteriores,
  pn.estado AS estado_plan,
  pn.id_perfil
FROM menus_diarios md
JOIN dias_plan dp ON dp.id_dia_plan = md.id_dia_plan
JOIN planes_semanales sp ON sp.id_semana = dp.id_semana
JOIN planes_nutricionales pn ON pn.id_plan = sp.id_plan
WHERE md.id_menu_diario = $1
`;

export const GET_PLATO_REPLACE_CONTEXT = `
SELECT
  id_plato,
  nombre,
  calorias_totales,
  tiempo_preparacion_min,
  id_tiempo_comida,
  activo
FROM platos
WHERE id_plato = $1
`;

export const UPDATE_MENU_PLATO = `
UPDATE menus_diarios
SET id_plato = $2,
    calorias_aportadas = $3,
    updated_at = NOW()
WHERE id_menu_diario = $1
RETURNING id_menu_diario, id_plato, calorias_aportadas
`;

export const INSERT_HISTORIAL_CAMBIO = `
INSERT INTO historial_cambios_menu
  (id_menu_diario, id_plato_anterior, id_plato_nuevo,
   motivo, id_usuario_accion)
VALUES ($1, $2, $3, $4, $5)
`;

export const GET_PENDING_SUGGESTION_FOR_MENU = `
SELECT id_sugerencia, motivo
FROM sugerencias_receta
WHERE id_menu_diario = $1
  AND estado = 'pendiente'
ORDER BY created_at ASC
LIMIT 1
`;
