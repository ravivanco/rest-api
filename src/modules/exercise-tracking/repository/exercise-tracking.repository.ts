import { pool } from '@database/pool';

export interface SeguimientoEjercicioRow {
  id_seguimiento_ejercicio: number;
  id_ejercicio_diario:      number;
  id_perfil:                number;
  fecha_registro:           string;
  completado:               boolean;
  hora_registro:            string | null;
  id_ejercicio?:            number;
  nombre_ejercicio?:        string;
  descripcion_ejercicio?:   string | null;
  duracion_min?:            number;
  intensidad?:              string;
  dia_semana?:              string;
  fecha_ejercicio?:         string;
}

export const exerciseTrackingRepository = {

  /**
   * Crea o actualiza el seguimiento de un ejercicio.
   */
  async upsert(data: {
    id_ejercicio_diario: number;
    id_perfil:           number;
    completado:          boolean;
    hora_registro?:      string | null;
  }): Promise<SeguimientoEjercicioRow> {

    const result = await pool.query<SeguimientoEjercicioRow>(
      `INSERT INTO seguimiento_ejercicios
         (id_ejercicio_diario, id_perfil, fecha_registro, completado, hora_registro)
       VALUES ($1, $2, CURRENT_DATE, $3, $4)
       ON CONFLICT (id_ejercicio_diario, id_perfil)
       DO UPDATE SET
         completado     = EXCLUDED.completado,
         hora_registro  = EXCLUDED.hora_registro,
         fecha_registro = CURRENT_DATE,
         updated_at     = NOW()
       RETURNING *`,
      [
        data.id_ejercicio_diario,
        data.id_perfil,
        data.completado,
        data.hora_registro ?? null,
      ],
    );
    return result.rows[0];
  },


  /**
   * Obtiene los ejercicios de un día específico del paciente con su estado.
   */
  async findTodayByPerfil(perfilId: number, fecha?: string): Promise<SeguimientoEjercicioRow[]> {
    const targetDate = fecha || new Date().toISOString().split('T')[0];
    const result = await pool.query<SeguimientoEjercicioRow>(
      `SELECT ed.id_ejercicio_diario,
              ed.id_ejercicio,
              e.nombre     AS nombre_ejercicio,
              e.descripcion AS descripcion_ejercicio,
              e.duracion_min,
              e.intensidad,
              e.categoria,
              dp.dia_semana,
              dp.fecha     AS fecha_ejercicio,
              se.id_seguimiento_ejercicio,
              se.completado,
              se.hora_registro
       FROM   dias_plan             dp
       JOIN   planes_semanales      ps  ON ps.id_semana   = dp.id_semana
       JOIN   planes_nutricionales  pn  ON pn.id_plan     = ps.id_plan
       JOIN   ejercicios_diarios    ed  ON ed.id_dia_plan = dp.id_dia_plan
       JOIN   ejercicios            e   ON e.id_ejercicio = ed.id_ejercicio
       LEFT JOIN seguimiento_ejercicios se
         ON se.id_ejercicio_diario = ed.id_ejercicio_diario
        AND se.id_perfil           = $1
       WHERE  pn.id_perfil        = $1
         AND  pn.estado           = 'activo'
         AND  pn.modulo_habilitado = TRUE
         AND  dp.fecha            = $2
       ORDER  BY e.nombre ASC`,
      [perfilId, targetDate],
    );
    return result.rows;
  },


  async getExerciseDate(ejercicioDiarioId: number): Promise<string | null> {
    const result = await pool.query<{ fecha: Date | string }>(
      `SELECT dp.fecha
       FROM   ejercicios_diarios ed
       JOIN   dias_plan          dp ON dp.id_dia_plan = ed.id_dia_plan
       WHERE  ed.id_ejercicio_diario = $1`,
      [ejercicioDiarioId],
    );
    const dateVal = result.rows[0]?.fecha;
    if (!dateVal) return null;
    return dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : String(dateVal).split('T')[0];
  },



  /**
   * Historial de seguimiento de ejercicios de un paciente por fecha.
   */
  async findByPerfilAndDate(
    perfilId: number,
    fecha:    string,
  ): Promise<SeguimientoEjercicioRow[]> {

    const result = await pool.query<SeguimientoEjercicioRow>(
      `SELECT se.*,
              e.nombre     AS nombre_ejercicio,
              e.duracion_min,
              e.intensidad,
              dp.dia_semana,
              dp.fecha     AS fecha_ejercicio
       FROM   seguimiento_ejercicios se
       JOIN   ejercicios_diarios     ed ON ed.id_ejercicio_diario = se.id_ejercicio_diario
       JOIN   ejercicios             e  ON e.id_ejercicio         = ed.id_ejercicio
       JOIN   dias_plan              dp ON dp.id_dia_plan         = ed.id_dia_plan
       WHERE  se.id_perfil      = $1
         AND  se.fecha_registro = $2
       ORDER  BY e.nombre ASC`,
      [perfilId, fecha],
    );
    return result.rows;
  },

};