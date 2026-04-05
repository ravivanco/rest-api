import { pool } from '@database/pool';

export interface AdherenciaRow {
  id_adherencia:                number;
  id_perfil:                    number;
  id_semana:                    number;
  pct_cumplimiento_alimenticio: number;
  pct_cumplimiento_ejercicio:   number;
  nivel:                        string;
  fecha_calculo:                string;
  numero_semana?:               number;
  fecha_inicio_semana?:         string;
  fecha_fin_semana?:            string;
}

export const adherenceRepository = {

  /**
   * Calcula el porcentaje de cumplimiento alimenticio de una semana.
   * Fórmula: comidas_realizadas / comidas_totales_del_plan * 100
   */
  async calcularCumplimientoAlimenticio(
    perfilId: number,
    semanaId: number,
  ): Promise<{ realizadas: number; total: number; pct: number }> {

    const result = await pool.query<{
      total_menus:     string;
      menus_realizados: string;
    }>(
      `SELECT
         COUNT(md.id_menu_diario)                          AS total_menus,
         SUM(CASE WHEN sc.realizado = TRUE THEN 1 ELSE 0 END) AS menus_realizados
       FROM   dias_plan             dp
       JOIN   menus_diarios         md  ON md.id_dia_plan      = dp.id_dia_plan
       LEFT JOIN seguimiento_comidas sc
         ON sc.id_menu_diario = md.id_menu_diario
        AND sc.id_perfil      = $1
       WHERE  dp.id_semana = $2`,
      [perfilId, semanaId],
    );

    const total     = parseInt(result.rows[0].total_menus) || 0;
    const realizadas = parseInt(result.rows[0].menus_realizados) || 0;
    const pct       = total > 0 ? Math.round((realizadas / total) * 100) : 0;

    return { realizadas, total, pct };
  },


  /**
   * Calcula el porcentaje de cumplimiento físico de una semana.
   */
  async calcularCumplimientoEjercicio(
    perfilId: number,
    semanaId: number,
  ): Promise<{ completados: number; total: number; pct: number }> {

    const result = await pool.query<{
      total_ejercicios:      string;
      ejercicios_completados: string;
    }>(
      `SELECT
         COUNT(ed.id_ejercicio_diario)                           AS total_ejercicios,
         SUM(CASE WHEN se.completado = TRUE THEN 1 ELSE 0 END)  AS ejercicios_completados
       FROM   dias_plan               dp
       JOIN   ejercicios_diarios      ed ON ed.id_dia_plan          = dp.id_dia_plan
       LEFT JOIN seguimiento_ejercicios se
         ON se.id_ejercicio_diario = ed.id_ejercicio_diario
        AND se.id_perfil           = $1
       WHERE  dp.id_semana = $2`,
      [perfilId, semanaId],
    );

    const total      = parseInt(result.rows[0].total_ejercicios) || 0;
    const completados = parseInt(result.rows[0].ejercicios_completados) || 0;
    const pct        = total > 0 ? Math.round((completados / total) * 100) : 0;

    return { completados, total, pct };
  },


  /**
   * Guarda o actualiza el índice de adherencia de una semana.
   */
  async upsert(data: {
    id_perfil:                    number;
    id_semana:                    number;
    pct_cumplimiento_alimenticio: number;
    pct_cumplimiento_ejercicio:   number;
    nivel:                        string;
  }): Promise<AdherenciaRow> {

    const result = await pool.query<AdherenciaRow>(
      `INSERT INTO indices_adherencia
         (id_perfil, id_semana,
          pct_cumplimiento_alimenticio, pct_cumplimiento_ejercicio,
          nivel, fecha_calculo)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (id_perfil, id_semana)
       DO UPDATE SET
         pct_cumplimiento_alimenticio = EXCLUDED.pct_cumplimiento_alimenticio,
         pct_cumplimiento_ejercicio   = EXCLUDED.pct_cumplimiento_ejercicio,
         nivel                        = EXCLUDED.nivel,
         fecha_calculo                = NOW()
       RETURNING *`,
      [
        data.id_perfil, data.id_semana,
        data.pct_cumplimiento_alimenticio,
        data.pct_cumplimiento_ejercicio,
        data.nivel,
      ],
    );
    return result.rows[0];
  },


  /**
   * Obtiene el historial de adherencia de un paciente con datos de la semana.
   */
  async findByPerfil(
    perfilId: number,
    limit:    number = 10,
    offset:   number = 0,
  ): Promise<{ rows: AdherenciaRow[]; total: number }> {

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM indices_adherencia WHERE id_perfil = $1`,
      [perfilId],
    );

    const dataResult = await pool.query<AdherenciaRow>(
      `SELECT ia.*,
              ps.numero              AS numero_semana,
              ps.fecha_inicio_semana,
              ps.fecha_fin_semana
       FROM   indices_adherencia ia
       JOIN   planes_semanales   ps ON ps.id_semana = ia.id_semana
       WHERE  ia.id_perfil = $1
       ORDER  BY ps.fecha_inicio_semana DESC
       LIMIT  $2 OFFSET $3`,
      [perfilId, limit, offset],
    );

    return {
      rows:  dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  },


  /**
   * Obtiene la semana actual activa del paciente para calcular adherencia en tiempo real.
   */
  async getCurrentWeek(perfilId: number): Promise<{
    id_semana:           number;
    numero:              number;
    fecha_inicio_semana: string;
    fecha_fin_semana:    string;
    id_plan:             number;
  } | null> {

    const result = await pool.query<{
      id_semana:           number;
      numero:              number;
      fecha_inicio_semana: string;
      fecha_fin_semana:    string;
      id_plan:             number;
    }>(
      `SELECT ps.id_semana, ps.numero,
              ps.fecha_inicio_semana, ps.fecha_fin_semana,
              ps.id_plan
       FROM   planes_semanales      ps
       JOIN   planes_nutricionales  pn ON pn.id_plan   = ps.id_plan
       WHERE  pn.id_perfil         = $1
         AND  pn.estado            = 'activo'
         AND  pn.modulo_habilitado = TRUE
         AND  ps.fecha_inicio_semana <= CURRENT_DATE
         AND  ps.fecha_fin_semana   >= CURRENT_DATE
       LIMIT  1`,
      [perfilId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Lista todas las semanas con plan activo de los pacientes
   * para el cálculo batch de adherencia.
   */
  async findActiveWeeks(): Promise<Array<{
    id_perfil:           number;
    id_semana:           number;
    id_nutricionista:    number;
  }>> {

    const result = await pool.query(
      `SELECT DISTINCT pp.id_perfil, ps.id_semana, pn.id_nutricionista
       FROM   planes_semanales      ps
       JOIN   planes_nutricionales  pn ON pn.id_plan   = ps.id_plan
       JOIN   perfiles_paciente     pp ON pp.id_perfil = pn.id_perfil
       WHERE  pn.estado            = 'activo'
         AND  pn.modulo_habilitado = TRUE
         AND  ps.fecha_fin_semana  < CURRENT_DATE`,
    );
    return result.rows;
  },

};