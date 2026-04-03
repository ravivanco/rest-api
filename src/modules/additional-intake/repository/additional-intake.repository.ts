import { pool } from '@database/pool';

export interface ConsumoAdicionalRow {
  id_consumo_adicional: number;
  id_perfil:            number;
  id_control:           number | null;
  fecha:                string;
  hora:                 string;
  descripcion_alimento: string;
  imagen_url:           string | null;
  calorias_estimadas:   number | null;
  confirmado:           boolean;
  calorias_sumadas:     boolean;
  created_at:           string;
  updated_at:           string;
}

export const additionalIntakeRepository = {

  /**
   * Registra un nuevo consumo adicional sin confirmar.
   * Las calorías NO se suman al balance hasta que confirme.
   */
  async create(data: {
    id_perfil:            number;
    descripcion_alimento: string;
    imagen_url?:          string | null;
    calorias_estimadas?:  number | null;
    hora?:                string | null;
  }): Promise<ConsumoAdicionalRow> {

    const result = await pool.query<ConsumoAdicionalRow>(
      `INSERT INTO consumos_adicionales
         (id_perfil, fecha, hora, descripcion_alimento,
          imagen_url, calorias_estimadas, confirmado, calorias_sumadas)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, FALSE, FALSE)
       RETURNING *`,
      [
        data.id_perfil,
        data.hora ?? new Date().toTimeString().slice(0, 5),
        data.descripcion_alimento,
        data.imagen_url ?? null,
        data.calorias_estimadas ?? null,
      ],
    );
    return result.rows[0];
  },


  /**
   * Busca un consumo adicional por ID.
   */
  async findById(id: number): Promise<ConsumoAdicionalRow | null> {
    const result = await pool.query<ConsumoAdicionalRow>(
      `SELECT * FROM consumos_adicionales WHERE id_consumo_adicional = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Confirma un consumo adicional y marca que sus calorías serán sumadas.
   * Actualiza también las calorías estimadas si se ajustaron.
   */
  async confirm(id: number, caloriasEstimadas: number): Promise<ConsumoAdicionalRow> {
    const result = await pool.query<ConsumoAdicionalRow>(
      `UPDATE consumos_adicionales
       SET confirmado         = TRUE,
           calorias_estimadas = $2,
           calorias_sumadas   = TRUE,
           updated_at         = NOW()
       WHERE id_consumo_adicional = $1
       RETURNING *`,
      [id, caloriasEstimadas],
    );
    return result.rows[0];
  },


  /**
   * Descarta un consumo adicional (no se suma al balance).
   */
  async discard(id: number): Promise<ConsumoAdicionalRow> {
    const result = await pool.query<ConsumoAdicionalRow>(
      `UPDATE consumos_adicionales
       SET confirmado       = FALSE,
           calorias_sumadas = FALSE,
           updated_at       = NOW()
       WHERE id_consumo_adicional = $1
       RETURNING *`,
      [id],
    );
    return result.rows[0];
  },


  /**
   * Vincula el consumo al control calórico del día.
   */
  async linkToControl(consumoId: number, controlId: number): Promise<void> {
    await pool.query(
      `UPDATE consumos_adicionales
       SET id_control = $2, updated_at = NOW()
       WHERE id_consumo_adicional = $1`,
      [consumoId, controlId],
    );
  },


  /**
   * Lista los consumos adicionales de un paciente con filtros.
   */
  async findByPerfil(
    perfilId: number,
    filters: {
      desde?:      string;
      hasta?:      string;
      confirmado?: string;
      limit:       number;
      offset:      number;
    },
  ): Promise<{ rows: ConsumoAdicionalRow[]; total: number }> {

    const conditions = ['id_perfil = $1'];
    const params: unknown[] = [perfilId];
    let idx = 2;

    if (filters.desde) {
      conditions.push(`fecha >= $${idx++}`);
      params.push(filters.desde);
    }

    if (filters.hasta) {
      conditions.push(`fecha <= $${idx++}`);
      params.push(filters.hasta);
    }

    if (filters.confirmado !== undefined) {
      conditions.push(`confirmado = $${idx++}`);
      params.push(filters.confirmado === 'true');
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM consumos_adicionales ${where}`,
      params,
    );

    const dataResult = await pool.query<ConsumoAdicionalRow>(
      `SELECT * FROM consumos_adicionales ${where}
       ORDER BY fecha DESC, hora DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      rows:  dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  },


  /**
   * Calcula el total de calorías adicionales confirmadas hoy.
   * Se usa para actualizar el control calórico.
   */
  async getTodayConfirmedCalories(perfilId: number): Promise<number> {
    const result = await pool.query<{ total: string }>(
      `SELECT COALESCE(SUM(calorias_estimadas), 0) AS total
       FROM   consumos_adicionales
       WHERE  id_perfil       = $1
         AND  fecha           = CURRENT_DATE
         AND  confirmado      = TRUE
         AND  calorias_sumadas = TRUE`,
      [perfilId],
    );
    return parseInt(result.rows[0].total);
  },


  /**
   * Obtiene el impacto calórico total de consumos adicionales de un período.
   * Útil para el análisis de la nutricionista.
   */
  async getImpactByPerfil(
    perfilId: number,
    desde?:   string,
    hasta?:   string,
  ): Promise<{
    total_consumos:    number;
    total_confirmados: number;
    total_descartados: number;
    calorias_totales:  number;
    promedio_por_dia:  number;
  }> {

    const conditions = ['id_perfil = $1'];
    const params: unknown[] = [perfilId];
    let idx = 2;

    if (desde) { conditions.push(`fecha >= $${idx++}`); params.push(desde); }
    if (hasta) { conditions.push(`fecha <= $${idx++}`); params.push(hasta); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const result = await pool.query<{
      total_consumos:    string;
      total_confirmados: string;
      total_descartados: string;
      calorias_totales:  string;
      dias_con_consumo:  string;
    }>(
      `SELECT
         COUNT(*)                                    AS total_consumos,
         SUM(CASE WHEN confirmado = TRUE  THEN 1 ELSE 0 END) AS total_confirmados,
         SUM(CASE WHEN confirmado = FALSE THEN 1 ELSE 0 END) AS total_descartados,
         COALESCE(SUM(CASE WHEN confirmado = TRUE THEN calorias_estimadas ELSE 0 END), 0)
                                                     AS calorias_totales,
         COUNT(DISTINCT CASE WHEN confirmado = TRUE THEN fecha END)
                                                     AS dias_con_consumo
       FROM consumos_adicionales ${where}`,
      params,
    );

    const row = result.rows[0];
    const diasConConsumo = parseInt(row.dias_con_consumo) || 1;

    return {
      total_consumos:    parseInt(row.total_consumos),
      total_confirmados: parseInt(row.total_confirmados),
      total_descartados: parseInt(row.total_descartados),
      calorias_totales:  parseInt(row.calorias_totales),
      promedio_por_dia:  Math.round(parseInt(row.calorias_totales) / diasConConsumo),
    };
  },

};