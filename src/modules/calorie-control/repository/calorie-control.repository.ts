import { pool } from '@database/pool';

export interface ControlCaloricoRow {
  id_control:                    number;
  id_perfil:                     number;
  id_dia_plan:                   number;
  fecha:                         string;
  calorias_objetivo:             number;
  calorias_consumidas_plan:      number;
  calorias_consumidas_adicional: number;
  calorias_totales_consumidas:   number;  // columna generada en PostgreSQL
  calorias_restantes:            number;  // columna generada en PostgreSQL
  created_at:                    string;
  updated_at:                    string;
}

export const calorieControlRepository = {

  /**
   * Obtiene o crea el control calórico del día actual.
   * Si no existe lo crea con las calorías objetivo de la última evaluación.
   */
  async findOrCreateToday(
    perfilId:          number,
    diaPlanId:         number,
    caloriasObjetivo:  number,
  ): Promise<ControlCaloricoRow> {

    // Intentar encontrar el registro de hoy
    const existing = await pool.query<ControlCaloricoRow>(
      `SELECT * FROM control_calorico
       WHERE id_perfil = $1 AND fecha = CURRENT_DATE`,
      [perfilId],
    );

    if (existing.rows[0]) return existing.rows[0];

    // Crear si no existe
    const result = await pool.query<ControlCaloricoRow>(
      `INSERT INTO control_calorico
         (id_perfil, id_dia_plan, fecha, calorias_objetivo)
       VALUES ($1, $2, CURRENT_DATE, $3)
       RETURNING *`,
      [perfilId, diaPlanId, caloriasObjetivo],
    );
    return result.rows[0];
  },


  /**
   * Actualiza las calorías consumidas del plan del día.
   * Recalcula a partir del total real (más preciso que incrementar).
   */
  async updatePlanCalories(perfilId: number, nuevasCaloriasConsumidasPlan: number): Promise<ControlCaloricoRow> {
    const result = await pool.query<ControlCaloricoRow>(
      `UPDATE control_calorico
       SET calorias_consumidas_plan = $2,
           updated_at               = NOW()
       WHERE id_perfil = $1 AND fecha = CURRENT_DATE
       RETURNING *`,
      [perfilId, nuevasCaloriasConsumidasPlan],
    );
    return result.rows[0];
  },


  /**
   * Actualiza las calorías de consumo adicional del día.
   */
  async updateAdditionalCalories(
    perfilId:                  number,
    nuevasCaloriasAdicionales: number,
  ): Promise<ControlCaloricoRow> {

    const result = await pool.query<ControlCaloricoRow>(
      `UPDATE control_calorico
       SET calorias_consumidas_adicional = $2,
           updated_at                    = NOW()
       WHERE id_perfil = $1 AND fecha = CURRENT_DATE
       RETURNING *`,
      [perfilId, nuevasCaloriasAdicionales],
    );
    return result.rows[0];
  },


  /**
   * Obtiene el control calórico de hoy para un paciente.
   */
  async findToday(perfilId: number): Promise<ControlCaloricoRow | null> {
    const result = await pool.query<ControlCaloricoRow>(
      `SELECT * FROM control_calorico
       WHERE id_perfil = $1 AND fecha = CURRENT_DATE`,
      [perfilId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Historial de control calórico con filtros de fecha.
   */
  async findHistory(
    perfilId: number,
    desde?:   string,
    hasta?:   string,
    limit:    number = 30,
    offset:   number = 0,
  ): Promise<{ rows: ControlCaloricoRow[]; total: number }> {

    const conditions = ['id_perfil = $1'];
    const params: unknown[] = [perfilId];
    let idx = 2;

    if (desde) { conditions.push(`fecha >= $${idx++}`); params.push(desde); }
    if (hasta) { conditions.push(`fecha <= $${idx++}`); params.push(hasta); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM control_calorico ${where}`,
      params,
    );

    const dataResult = await pool.query<ControlCaloricoRow>(
      `SELECT * FROM control_calorico ${where}
       ORDER BY fecha DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, limit, offset],
    );

    return {
      rows:  dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  },

};