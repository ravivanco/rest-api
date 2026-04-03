import { pool } from '@database/pool';

export interface RegistroPesoRow {
  id_registro_peso: number;
  id_perfil:        number;
  fecha:            string;
  peso_kg:          number;
  created_at:       string;
}

export const weightRecordsRepository = {

  /**
   * Crea un registro de peso del día.
   * Solo puede haber un registro por día por paciente.
   */
  async create(perfilId: number, pesoKg: number): Promise<RegistroPesoRow> {
    const result = await pool.query<RegistroPesoRow>(
      `INSERT INTO registros_peso (id_perfil, fecha, peso_kg)
       VALUES ($1, CURRENT_DATE, $2)
       RETURNING *`,
      [perfilId, pesoKg],
    );
    return result.rows[0];
  },


  /**
   * Verifica si ya existe un registro de peso hoy para el paciente.
   */
  async existsToday(perfilId: number): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM registros_peso
         WHERE id_perfil = $1 AND fecha = CURRENT_DATE
       ) as exists`,
      [perfilId],
    );
    return result.rows[0].exists;
  },


  /**
   * Obtiene el historial de peso de un paciente con diferencias entre registros.
   */
  async findByPerfil(
    perfilId: number,
    limit:    number = 30,
    offset:   number = 0,
  ): Promise<{ rows: RegistroPesoRow[]; total: number }> {

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM registros_peso WHERE id_perfil = $1`,
      [perfilId],
    );

    const dataResult = await pool.query<RegistroPesoRow>(
      `SELECT * FROM registros_peso
       WHERE  id_perfil = $1
       ORDER  BY fecha DESC
       LIMIT  $2 OFFSET $3`,
      [perfilId, limit, offset],
    );

    return {
      rows:  dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  },


  /**
   * Obtiene el peso del día anterior para calcular la diferencia.
   */
  async findYesterday(perfilId: number): Promise<RegistroPesoRow | null> {
    const result = await pool.query<RegistroPesoRow>(
      `SELECT * FROM registros_peso
       WHERE  id_perfil = $1
         AND  fecha < CURRENT_DATE
       ORDER  BY fecha DESC
       LIMIT  1`,
      [perfilId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Obtiene el primer registro de peso (peso inicial del plan).
   */
  async findFirst(perfilId: number): Promise<RegistroPesoRow | null> {
    const result = await pool.query<RegistroPesoRow>(
      `SELECT * FROM registros_peso
       WHERE  id_perfil = $1
       ORDER  BY fecha ASC
       LIMIT  1`,
      [perfilId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Serie de peso para gráficos.
   */
  async findForChart(perfilId: number, days: number = 30): Promise<RegistroPesoRow[]> {
    const result = await pool.query<RegistroPesoRow>(
      `SELECT * FROM registros_peso
       WHERE  id_perfil = $1
         AND  fecha >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER  BY fecha ASC`,
      [perfilId],
    );
    return result.rows;
  },

};