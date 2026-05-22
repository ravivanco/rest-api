export const GET_PERFIL_EVALUACION = `
  SELECT pp.id_perfil,
         pp.nivel_actividad_fisica,
         pp.objetivo,
         pp.alergias_intolerancias,
         pp.restricciones_alimenticias,
         ec.id_evaluacion,
         ec.peso_kg,
         ec.imc,
         ec.calorias_diarias_calculadas,
         ec.distribucion_carbohidratos_pct,
         ec.distribucion_proteinas_pct,
         ec.distribucion_grasas_pct
  FROM perfiles_paciente pp
  JOIN evaluaciones_clinicas ec ON ec.id_perfil = pp.id_perfil
  WHERE pp.id_perfil = $1 AND ec.id_evaluacion = $2
`;

export const GET_CONDICIONES = `
  SELECT cm.nombre
  FROM paciente_condiciones pc
  JOIN condiciones_medicas cm ON cm.id_condicion = pc.id_condicion
  WHERE pc.id_perfil = $1
  ORDER BY cm.nombre
`;

export const GET_PREFERENCIAS = `
  SELECT a.nombre, a.categoria, pa.tipo
  FROM preferencias_alimenticias pa
  JOIN alimentos a ON a.id_alimento = pa.id_alimento
  WHERE pa.id_perfil = $1
  ORDER BY pa.tipo, a.nombre
`;

export const GET_ALIMENTOS_DETALLE_BY_CATEGORIAS = `
  SELECT id_alimento_detalle, nombre, categoria, calorias, proteinas,
         carbohidratos, grasas, fibra, sodio
  FROM alimentos_detalle
  WHERE categoria = ANY($1::text[])
  ORDER BY categoria, nombre
  LIMIT 120
`;

export const GET_CATEGORIAS_DETALLE = `
  SELECT DISTINCT categoria
  FROM alimentos_detalle
  WHERE categoria = ANY($1::text[])
`;

export const GET_ALIMENTOS_DETALLE_ALL = `
  SELECT id_alimento_detalle, nombre, categoria, calorias, proteinas,
         carbohidratos, grasas, fibra, sodio
  FROM alimentos_detalle
  ORDER BY categoria, nombre
  LIMIT 100
`;

export const GET_CATALOGO_NOMBRES = `
  SELECT nombre
  FROM alimentos_detalle
  ORDER BY categoria, nombre ASC
`;

export const MATCH_INGREDIENTE_POR_NOMBRE = `
  SELECT
    id_alimento_detalle,
    nombre,
    calorias,
    proteinas,
    carbohidratos,
    grasas,
    fibra,
    sodio
  FROM alimentos_detalle
  WHERE unaccent(LOWER(nombre)) ILIKE unaccent(LOWER($1))
  ORDER BY
    CASE WHEN unaccent(LOWER(nombre)) = unaccent(LOWER($2)) THEN 0 ELSE 1 END,
    LENGTH(nombre) ASC
  LIMIT 1
`;

export const GET_APTITUDES_CLINICAS_BY_IDS = `
  SELECT id_aptitud, nombre
  FROM aptitudes_clinicas
  WHERE id_aptitud = ANY($1::int[])
  ORDER BY id_aptitud ASC
`;

export const FIND_CACHED_PLATO = `
  SELECT
    p.id_plato,
    p.nombre,
    p.descripcion,
    p.calorias_totales,
    p.tiempo_preparacion_min
  FROM platos p
  WHERE p.id_tiempo_comida = $1
    AND p.activo = true
    AND p.generado_por_ia = true
    AND p.calorias_totales BETWEEN $2 AND $3
    AND NOT EXISTS (
      SELECT 1
      FROM menus_diarios md
      JOIN dias_plan dp ON dp.id_dia_plan = md.id_dia_plan
      JOIN planes_semanales ps ON ps.id_semana = dp.id_semana
      JOIN planes_nutricionales pn ON pn.id_plan = ps.id_plan
      WHERE md.id_plato = p.id_plato
        AND pn.id_perfil = $4
        AND dp.fecha >= CURRENT_DATE - INTERVAL '14 days'
    )
  ORDER BY RANDOM()
  LIMIT 1
`;

export const FIND_CACHED_PLATO_GENERIC = `
  SELECT
    id_plato,
    nombre,
    descripcion,
    calorias_totales,
    tiempo_preparacion_min
  FROM platos
  WHERE id_tiempo_comida = $1
    AND activo = true
    AND generado_por_ia = true
    AND calorias_totales BETWEEN $2 AND $3
  ORDER BY RANDOM()
  LIMIT 1
`;

export const GET_TIEMPO_COMIDA_BY_ID = `
  SELECT id_tiempo_comida
  FROM tiempos_comida
  WHERE id_tiempo_comida = $1 AND activo = true
`;

export const GET_INGREDIENTES_PLATO = `
  SELECT
    pi.id_alimento_detalle,
    ad.nombre,
    pi.cantidad_g,
    ROUND((ad.calorias * pi.cantidad_g / 100)::numeric, 0)::integer AS calorias_aportadas
  FROM plato_ingredientes pi
  JOIN alimentos_detalle ad ON ad.id_alimento_detalle = pi.id_alimento_detalle
  WHERE pi.id_plato = $1
`;

export const INSERT_PLATO = `
  INSERT INTO platos (
    nombre,
    descripcion,
    modo_preparacion,
    enlace_video,
    calorias_totales,
    tiempo_preparacion_min,
    id_tiempo_comida,
    generado_por_ia,
    activo,
    imagen_url,
    imagen_public_id
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, NULL, NULL)
  RETURNING id_plato
`;

export const INSERT_PLATO_INGREDIENTE = `
  INSERT INTO plato_ingredientes (
    id_plato,
    id_alimento,
    id_alimento_detalle,
    cantidad_g
  )
  VALUES ($1, NULL, $2, $3)
`;

export const INSERT_PLATO_APTITUD = `
  INSERT INTO plato_aptitudes (id_plato, id_aptitud)
  VALUES ($1, $2)
  ON CONFLICT (id_plato, id_aptitud) DO NOTHING
`;

export const INSERT_MENU_DIARIO = `
  INSERT INTO menus_diarios (
    id_dia_plan,
    id_tiempo_comida,
    id_plato,
    calorias_aportadas
  )
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (id_dia_plan, id_tiempo_comida)
  DO UPDATE SET
    id_plato = EXCLUDED.id_plato,
    calorias_aportadas = EXCLUDED.calorias_aportadas,
    updated_at = NOW()
  RETURNING id_menu_diario
`;

export const GET_PLAN_CON_PERFIL = `
  SELECT
    pn.id_plan,
    pn.id_perfil,
    pn.id_nutricionista,
    pn.estado,
    pn.modulo_habilitado
  FROM planes_nutricionales pn
  WHERE pn.id_plan = $1
`;

export const GET_SEMANA_DEL_PLAN = `
  SELECT
    ps.id_semana,
    ps.id_plan,
    ps.numero,
    ps.fecha_inicio_semana,
    ps.fecha_fin_semana
  FROM planes_semanales ps
  WHERE ps.id_semana = $1
    AND ps.id_plan = $2
`;

export const GET_DIAS_SEMANA = `
  SELECT
    id_dia_plan,
    id_semana,
    dia_semana,
    fecha
  FROM dias_plan
  WHERE id_semana = $1
  ORDER BY fecha ASC
`;

export const GET_TIEMPOS_COMIDA_ACTIVOS = `
  SELECT
    id_tiempo_comida,
    nombre
  FROM tiempos_comida
  WHERE activo = true
  ORDER BY orden ASC
`;

export const GET_MENUS_SEMANA = `
  SELECT
    md.id_menu_diario,
    md.id_dia_plan,
    md.id_tiempo_comida,
    md.id_plato,
    md.calorias_aportadas,
    p.nombre AS nombre_plato
  FROM menus_diarios md
  JOIN dias_plan dp ON dp.id_dia_plan = md.id_dia_plan
  JOIN platos p ON p.id_plato = md.id_plato
  WHERE dp.id_semana = $1
`;
