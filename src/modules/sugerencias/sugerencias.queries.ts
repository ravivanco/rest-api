export const GET_SUGERENCIAS_PENDIENTES = `
SELECT
  s.id_sugerencia,
  s.motivo,
  s.estado,
  s.created_at,
  md.id_menu_diario,
  dp.fecha,
  tc.nombre AS tiempo_comida,
  pa.id_plato AS id_plato_actual,
  pa.nombre AS nombre_plato_actual,
  pa.calorias_totales AS calorias_plato_actual,
  ps.id_plato AS id_plato_sugerido,
  ps.nombre AS nombre_plato_sugerido,
  ps.calorias_totales AS calorias_plato_sugerido
FROM sugerencias_receta s
JOIN menus_diarios md ON md.id_menu_diario = s.id_menu_diario
JOIN dias_plan dp ON dp.id_dia_plan = md.id_dia_plan
JOIN tiempos_comida tc ON tc.id_tiempo_comida = md.id_tiempo_comida
JOIN platos pa ON pa.id_plato = md.id_plato
JOIN platos ps ON ps.id_plato = s.id_plato_sugerido
JOIN planes_semanales sp ON sp.id_semana = dp.id_semana
JOIN planes_nutricionales pn ON pn.id_plan = sp.id_plan
WHERE s.estado = $1
  AND ($2::integer IS NULL OR pn.id_perfil = $2)
  AND ($3::integer IS NULL OR pn.id_plan = $3)
ORDER BY s.created_at DESC
`;

export const GET_SUGERENCIA_BY_ID = `
SELECT
  s.id_sugerencia,
  s.id_menu_diario,
  s.id_plato_sugerido,
  s.motivo,
  s.estado,
  s.id_nutricionista_revisor,
  s.fecha_revision,
  s.created_at,
  md.id_plato AS id_plato_actual,
  md.id_tiempo_comida,
  md.id_dia_plan,
  pn.estado AS estado_plan,
  pn.id_perfil,
  ps.nombre AS nombre_plato_sugerido,
  ps.calorias_totales AS calorias_plato_sugerido
FROM sugerencias_receta s
JOIN menus_diarios md ON md.id_menu_diario = s.id_menu_diario
JOIN dias_plan dp ON dp.id_dia_plan = md.id_dia_plan
JOIN planes_semanales sp ON sp.id_semana = dp.id_semana
JOIN planes_nutricionales pn ON pn.id_plan = sp.id_plan
JOIN platos ps ON ps.id_plato = s.id_plato_sugerido
WHERE s.id_sugerencia = $1
`;

export const UPDATE_SUGERENCIA_ESTADO = `
UPDATE sugerencias_receta
SET estado = $2,
    id_nutricionista_revisor = $3,
    fecha_revision = NOW()
WHERE id_sugerencia = $1
RETURNING id_sugerencia, id_menu_diario, id_plato_sugerido, motivo, estado, id_nutricionista_revisor, fecha_revision
`;

export const REJECT_OTHER_PENDING_SUGERENCIAS = `
UPDATE sugerencias_receta
SET estado = 'rechazada',
    id_nutricionista_revisor = $2,
    fecha_revision = NOW()
WHERE id_menu_diario = $1
  AND estado = 'pendiente'
  AND id_sugerencia <> $3
`;
