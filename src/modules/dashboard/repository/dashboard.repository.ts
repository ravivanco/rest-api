import { pool } from '@database/pool';

export const dashboardRepository = {

  /**
   * Resumen general para el dashboard de la nutricionista.
   */
  async getNutritionistSummary(nutricionistaId: number): Promise<{
    total_pacientes:   number;
    planes_activos:    number;
    planes_pendientes: number;
    planes_suspendidos: number;
    formularios_pendientes: number;
    alertas_sin_revisar: number;
  }> {

    const result = await pool.query<{
      total_pacientes:        string;
      planes_activos:         string;
      planes_pendientes:      string;
      planes_suspendidos:     string;
      formularios_pendientes: string;
    }>(
      `SELECT
         COUNT(DISTINCT pp.id_perfil)                                   AS total_pacientes,
         SUM(CASE WHEN pn.estado = 'activo'     THEN 1 ELSE 0 END)    AS planes_activos,
         SUM(CASE WHEN pn.estado = 'pendiente'  THEN 1 ELSE 0 END)    AS planes_pendientes,
         SUM(CASE WHEN pn.estado = 'suspendido' THEN 1 ELSE 0 END)    AS planes_suspendidos,
         SUM(CASE WHEN pp.formulario_completado = FALSE THEN 1 ELSE 0 END) AS formularios_pendientes
       FROM perfiles_paciente pp
       LEFT JOIN LATERAL (
         SELECT estado FROM planes_nutricionales
         WHERE id_perfil = pp.id_perfil
           AND id_nutricionista = $1
         ORDER BY created_at DESC LIMIT 1
       ) pn ON TRUE`,
      [nutricionistaId],
    );

    const alertasResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM alertas_sistema
       WHERE id_nutricionista = $1 AND revisada = FALSE`,
      [nutricionistaId],
    );

    const row = result.rows[0];

    return {
      total_pacientes:        parseInt(row.total_pacientes)        || 0,
      planes_activos:         parseInt(row.planes_activos)         || 0,
      planes_pendientes:      parseInt(row.planes_pendientes)      || 0,
      planes_suspendidos:     parseInt(row.planes_suspendidos)     || 0,
      formularios_pendientes: parseInt(row.formularios_pendientes) || 0,
      alertas_sin_revisar:    parseInt(alertasResult.rows[0].total) || 0,
    };
  },


  /**
   * Distribución de pacientes por nivel de adherencia.
   */
  async getAdherenceDistribution(nutricionistaId: number): Promise<{
    alto:  number;
    medio: number;
    bajo:  number;
    sin_datos: number;
  }> {

    const result = await pool.query<{
      nivel:   string | null;
      total:   string;
    }>(
      `SELECT ia.nivel, COUNT(DISTINCT pp.id_perfil) AS total
       FROM   perfiles_paciente    pp
       LEFT JOIN planes_nutricionales pn
         ON  pn.id_perfil       = pp.id_perfil
         AND pn.id_nutricionista = $1
         AND pn.estado          = 'activo'
       LEFT JOIN LATERAL (
         SELECT ia2.nivel FROM indices_adherencia ia2
         WHERE ia2.id_perfil = pp.id_perfil
         ORDER BY ia2.fecha_calculo DESC LIMIT 1
       ) ia ON TRUE
       GROUP BY ia.nivel`,
      [nutricionistaId],
    );

    const dist = { alto: 0, medio: 0, bajo: 0, sin_datos: 0 };
    for (const row of result.rows) {
      if (row.nivel === 'alto')  dist.alto  = parseInt(row.total);
      else if (row.nivel === 'medio') dist.medio = parseInt(row.total);
      else if (row.nivel === 'bajo')  dist.bajo  = parseInt(row.total);
      else                            dist.sin_datos += parseInt(row.total);
    }
    return dist;
  },


  /**
   * Dashboard completo de un paciente individual.
   */
  async getPatientDashboard(perfilId: number): Promise<{
    perfil:       Record<string, unknown>;
    plan_activo:  Record<string, unknown> | null;
    ultima_evaluacion: Record<string, unknown> | null;
    peso_actual:  Record<string, unknown> | null;
    adherencia_actual: Record<string, unknown> | null;
    balance_hoy:  Record<string, unknown> | null;
    citas_proximas: Record<string, unknown>[];
  }> {

    // Datos básicos del paciente
    const perfilResult = await pool.query(
      `SELECT u.nombres, u.apellidos, u.correo_institucional,
              u.edad, u.fecha_nacimiento, u.sexo, pp.nivel_actividad_fisica,
              pp.objetivo, pp.formulario_completado
       FROM   usuarios u JOIN perfiles_paciente pp ON pp.id_usuario = u.id_usuario
       WHERE  pp.id_perfil = $1`,
      [perfilId],
    );

    // Plan activo
    const planResult = await pool.query(
      `SELECT id_plan, estado, modulo_habilitado, fecha_inicio, fecha_fin
       FROM   planes_nutricionales
       WHERE  id_perfil = $1 AND estado = 'activo'
       ORDER  BY created_at DESC LIMIT 1`,
      [perfilId],
    );

    // Última evaluación
    const evalResult = await pool.query(
      `SELECT fecha_evaluacion, peso_kg, imc,
              porcentaje_grasa, masa_muscular_kg,
              calorias_diarias_calculadas
       FROM   evaluaciones_clinicas
       WHERE  id_perfil = $1
       ORDER  BY fecha_evaluacion DESC LIMIT 1`,
      [perfilId],
    );

    // Peso más reciente
    const pesoResult = await pool.query(
      `SELECT fecha, peso_kg FROM registros_peso
       WHERE id_perfil = $1 ORDER BY fecha DESC LIMIT 1`,
      [perfilId],
    );

    // Adherencia más reciente
    const adherenciaResult = await pool.query(
      `SELECT ia.pct_cumplimiento_alimenticio, ia.pct_cumplimiento_ejercicio,
              ia.nivel, ia.fecha_calculo,
              ps.numero AS semana_numero
       FROM   indices_adherencia ia
       JOIN   planes_semanales   ps ON ps.id_semana = ia.id_semana
       WHERE  ia.id_perfil = $1
       ORDER  BY ia.fecha_calculo DESC LIMIT 1`,
      [perfilId],
    );

    // Balance calórico de hoy
    const balanceResult = await pool.query(
      `SELECT calorias_objetivo, calorias_totales_consumidas, calorias_restantes
       FROM   control_calorico
       WHERE  id_perfil = $1 AND fecha = CURRENT_DATE`,
      [perfilId],
    );

    // Próximas citas
    const citasResult = await pool.query(
      `SELECT id_cita, fecha_hora, estado, notas
       FROM   citas
       WHERE  id_perfil = $1
         AND  estado    = 'programada'
         AND  fecha_hora >= NOW()
       ORDER  BY fecha_hora ASC LIMIT 3`,
      [perfilId],
    );

    return {
      perfil:             perfilResult.rows[0] ?? {},
      plan_activo:        planResult.rows[0] ?? null,
      ultima_evaluacion:  evalResult.rows[0] ?? null,
      peso_actual:        pesoResult.rows[0] ?? null,
      adherencia_actual:  adherenciaResult.rows[0] ?? null,
      balance_hoy:        balanceResult.rows[0] ?? null,
      citas_proximas:     citasResult.rows,
    };
  },


  /**
   * Progreso del paciente — para la app móvil.
   * Serie temporal de los últimos N días.
   */
  async getPatientProgress(perfilId: number, days: number = 30): Promise<{
    peso:     Record<string, unknown>[];
    calorias: Record<string, unknown>[];
    adherencia: Record<string, unknown>[];
  }> {

    const pesoResult = await pool.query(
      `SELECT fecha, peso_kg FROM registros_peso
       WHERE id_perfil = $1
         AND fecha >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY fecha ASC`,
      [perfilId],
    );

    const caloriaResult = await pool.query(
      `SELECT fecha, calorias_objetivo, calorias_totales_consumidas, calorias_restantes
       FROM   control_calorico
       WHERE  id_perfil = $1
         AND  fecha >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER  BY fecha ASC`,
      [perfilId],
    );

    const adherenciaResult = await pool.query(
      `SELECT ps.fecha_inicio_semana, ia.pct_cumplimiento_alimenticio,
              ia.pct_cumplimiento_ejercicio, ia.nivel
       FROM   indices_adherencia ia
       JOIN   planes_semanales   ps ON ps.id_semana = ia.id_semana
       WHERE  ia.id_perfil = $1
       ORDER  BY ps.fecha_inicio_semana DESC LIMIT 8`,
      [perfilId],
    );

    return {
      peso:       pesoResult.rows,
      calorias:   caloriaResult.rows,
      adherencia: adherenciaResult.rows,
    };
  },

};