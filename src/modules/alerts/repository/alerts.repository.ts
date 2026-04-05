import { pool } from '@database/pool';

export interface AlertaRow {
  id_alerta_sistema:  number;
  id_perfil:          number;
  id_nutricionista:   number;
  tipo:               string;
  mensaje:            string;
  fecha_generacion:   string;
  revisada:           boolean;
  fecha_revision:     string | null;
  nombre_paciente?:   string;
  correo_paciente?:   string;
}

export const alertsRepository = {

  /**
   * Crea una alerta del sistema para la nutricionista.
   */
  async create(data: {
    id_perfil:        number;
    id_nutricionista: number;
    tipo:             string;
    mensaje:          string;
  }): Promise<AlertaRow> {

    const result = await pool.query<AlertaRow>(
      `INSERT INTO alertas_sistema
         (id_perfil, id_nutricionista, tipo, mensaje)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.id_perfil, data.id_nutricionista, data.tipo, data.mensaje],
    );
    return result.rows[0];
  },


  /**
   * Lista las alertas de la nutricionista con filtros.
   */
  async findByNutricionista(
    nutricionistaId: number,
    filters: {
      tipo?:     string;
      revisada?: string;
      limit:     number;
      offset:    number;
    },
  ): Promise<{ rows: AlertaRow[]; total: number; sin_revisar: number }> {

    const conditions = ['a.id_nutricionista = $1'];
    const params: unknown[] = [nutricionistaId];
    let idx = 2;

    if (filters.tipo) {
      conditions.push(`a.tipo = $${idx++}`);
      params.push(filters.tipo);
    }

    if (filters.revisada !== undefined) {
      conditions.push(`a.revisada = $${idx++}`);
      params.push(filters.revisada === 'true');
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const sinRevisarResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM alertas_sistema
       WHERE id_nutricionista = $1 AND revisada = FALSE`,
      [nutricionistaId],
    );

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM alertas_sistema a ${where}`,
      params,
    );

    const dataResult = await pool.query<AlertaRow>(
      `SELECT a.*,
              u.nombres  || ' ' || u.apellidos AS nombre_paciente,
              u.correo_institucional            AS correo_paciente
       FROM   alertas_sistema    a
       JOIN   perfiles_paciente  pp ON pp.id_perfil  = a.id_perfil
       JOIN   usuarios           u  ON u.id_usuario  = pp.id_usuario
       ${where}
       ORDER  BY a.fecha_generacion DESC
       LIMIT  $${idx++} OFFSET $${idx}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      rows:        dataResult.rows,
      total:       parseInt(countResult.rows[0].total),
      sin_revisar: parseInt(sinRevisarResult.rows[0].total),
    };
  },


  /**
   * Obtiene una alerta por ID.
   */
  async findById(id: number): Promise<AlertaRow | null> {
    const result = await pool.query<AlertaRow>(
      `SELECT a.*,
              u.nombres || ' ' || u.apellidos AS nombre_paciente
       FROM   alertas_sistema   a
       JOIN   perfiles_paciente pp ON pp.id_perfil = a.id_perfil
       JOIN   usuarios          u  ON u.id_usuario = pp.id_usuario
       WHERE  a.id_alerta_sistema = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Marca una alerta como revisada.
   */
  async markReviewed(id: number): Promise<AlertaRow> {
    const result = await pool.query<AlertaRow>(
      `UPDATE alertas_sistema
       SET    revisada       = TRUE,
              fecha_revision = NOW()
       WHERE  id_alerta_sistema = $1
       RETURNING *`,
      [id],
    );
    return result.rows[0];
  },


  /**
   * Verifica si ya existe una alerta del mismo tipo para el mismo paciente hoy.
   * Evita crear alertas duplicadas.
   */
  async existsToday(perfilId: number, tipo: string): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM alertas_sistema
         WHERE id_perfil = $1
           AND tipo      = $2
           AND fecha_generacion::date = CURRENT_DATE
       ) as exists`,
      [perfilId, tipo],
    );
    return result.rows[0].exists;
  },


  /**
   * Obtiene alertas de un paciente específico.
   */
  async findByPerfil(perfilId: number): Promise<AlertaRow[]> {
    const result = await pool.query<AlertaRow>(
      `SELECT * FROM alertas_sistema
       WHERE id_perfil = $1
       ORDER BY fecha_generacion DESC
       LIMIT 20`,
      [perfilId],
    );
    return result.rows;
  },

};