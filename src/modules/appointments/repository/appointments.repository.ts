import { pool } from '@database/pool';

export interface CitaRow {
  id_cita:           number;
  id_perfil:         number;
  id_nutricionista:  number;
  id_evaluacion:     number | null;
  fecha_hora:        string;
  estado:            string;
  notas:             string | null;
  created_at:        string;
  updated_at:        string;
  // Datos relacionados (JOIN)
  nombre_paciente?:  string;
  correo_paciente?:  string;
}

export const appointmentsRepository = {

  /**
   * Crea una nueva cita.
   */
  async create(data: {
    id_perfil:        number;
    id_nutricionista: number;
    fecha_hora:       string;
    notas?:           string | null;
  }): Promise<CitaRow> {

    const result = await pool.query<CitaRow>(
      `INSERT INTO citas
         (id_perfil, id_nutricionista, fecha_hora, notas, estado)
       VALUES ($1, $2, $3, $4, 'programada')
       RETURNING *`,
      [
        data.id_perfil,
        data.id_nutricionista,
        data.fecha_hora,
        data.notas ?? null,
      ],
    );
    return result.rows[0];
  },


  /**
   * Lista citas con filtros opcionales.
   * Puede filtrar por nutricionista, paciente, estado y rango de fechas.
   */
  async findAll(filters: {
    id_nutricionista: number;
    id_perfil?:       number;
    estado?:          string;
    desde?:           string;
    hasta?:           string;
    limit:            number;
    offset:           number;
  }): Promise<{ rows: CitaRow[]; total: number }> {

    const conditions = ['c.id_nutricionista = $1'];
    const params: unknown[] = [filters.id_nutricionista];
    let idx = 2;

    if (filters.id_perfil) {
      conditions.push(`c.id_perfil = $${idx++}`);
      params.push(filters.id_perfil);
    }

    if (filters.estado) {
      conditions.push(`c.estado = $${idx++}`);
      params.push(filters.estado);
    }

    if (filters.desde) {
      conditions.push(`c.fecha_hora >= $${idx++}`);
      params.push(filters.desde);
    }

    if (filters.hasta) {
      conditions.push(`c.fecha_hora <= $${idx++} || 'T23:59:59'`);
      params.push(filters.hasta);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM citas c ${where}`,
      params,
    );

    const dataResult = await pool.query<CitaRow>(
      `SELECT c.*,
              u.nombres || ' ' || u.apellidos AS nombre_paciente,
              u.correo_institucional          AS correo_paciente
       FROM   citas             c
       JOIN   perfiles_paciente pp ON pp.id_perfil = c.id_perfil
       JOIN   usuarios          u  ON u.id_usuario = pp.id_usuario
       ${where}
       ORDER  BY c.fecha_hora DESC
       LIMIT  $${idx++} OFFSET $${idx}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      rows:  dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  },


  /**
   * Obtiene el detalle de una cita con datos del paciente y evaluación vinculada.
   */
  async findById(id: number): Promise<CitaRow | null> {
    const result = await pool.query<CitaRow>(
      `SELECT c.*,
              u.nombres || ' ' || u.apellidos AS nombre_paciente,
              u.correo_institucional          AS correo_paciente,
              ec.fecha_evaluacion,
              ec.peso_kg,
              ec.imc,
              ec.calorias_diarias_calculadas
       FROM   citas              c
       JOIN   perfiles_paciente  pp ON pp.id_perfil    = c.id_perfil
       JOIN   usuarios           u  ON u.id_usuario    = pp.id_usuario
       LEFT JOIN evaluaciones_clinicas ec ON ec.id_evaluacion = c.id_evaluacion
       WHERE  c.id_cita = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Actualiza la fecha, hora y/o notas de una cita.
   */
  async update(
    id:   number,
    data: { fecha_hora?: string; notas?: string | null },
  ): Promise<CitaRow | null> {

    const fields: string[] = [];
    const values: unknown[] = [];
    let   idx = 1;

    if (data.fecha_hora !== undefined) {
      fields.push(`fecha_hora = $${idx++}`);
      values.push(data.fecha_hora);
    }

    if (data.notas !== undefined) {
      fields.push(`notas = $${idx++}`);
      values.push(data.notas);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query<CitaRow>(
      `UPDATE citas
       SET    ${fields.join(', ')}
       WHERE  id_cita = $${idx}
       RETURNING *`,
      values,
    );
    return result.rows[0] ?? null;
  },


  /**
   * Cambia el estado de una cita.
   * Actualiza también las notas si se proporcionan.
   */
  async changeStatus(
    id:     number,
    estado: string,
    notas?: string | null,
  ): Promise<CitaRow | null> {

    const result = await pool.query<CitaRow>(
      `UPDATE citas
       SET    estado     = $2,
              notas      = COALESCE($3, notas),
              updated_at = NOW()
       WHERE  id_cita = $1
       RETURNING *`,
      [id, estado, notas ?? null],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Vincula una evaluación clínica a una cita.
   * Útil cuando la nutricionista registra la evaluación durante la cita.
   */
  async linkEvaluation(citaId: number, evaluacionId: number): Promise<CitaRow | null> {
    const result = await pool.query<CitaRow>(
      `UPDATE citas
       SET    id_evaluacion = $2,
              updated_at    = NOW()
       WHERE  id_cita = $1
       RETURNING *`,
      [citaId, evaluacionId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Elimina una cita.
   * Solo se puede eliminar si está en estado 'programada'.
   */
  async delete(id: number): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM citas WHERE id_cita = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  },


  /**
   * Lista las citas de un paciente específico.
   * El paciente ve sus propias citas desde la app móvil.
   */
  async findByPerfil(
    perfilId: number,
    soloProximas: boolean = false,
  ): Promise<CitaRow[]> {

    const condicion = soloProximas
      ? `AND c.estado = 'programada' AND c.fecha_hora >= NOW()`
      : '';

    const result = await pool.query<CitaRow>(
      `SELECT c.*,
              un.nombres || ' ' || un.apellidos AS nombre_nutricionista
       FROM   citas   c
       JOIN   usuarios un ON un.id_usuario = c.id_nutricionista
       WHERE  c.id_perfil = $1
       ${condicion}
       ORDER  BY c.fecha_hora DESC
       LIMIT  20`,
      [perfilId],
    );
    return result.rows;
  },


  /**
   * Cuenta las citas por estado de un paciente.
   * Útil para el historial de cumplimiento.
   */
  async getComplianceStats(perfilId: number): Promise<{
    total:        number;
    atendidas:    number;
    canceladas:   number;
    reprogramadas: number;
    programadas:  number;
    pct_asistencia: number;
  }> {

    const result = await pool.query<{
      total:        string;
      atendidas:    string;
      canceladas:   string;
      reprogramadas: string;
      programadas:  string;
    }>(
      `SELECT
         COUNT(*)                                                    AS total,
         SUM(CASE WHEN estado = 'atendida'     THEN 1 ELSE 0 END)  AS atendidas,
         SUM(CASE WHEN estado = 'cancelada'    THEN 1 ELSE 0 END)  AS canceladas,
         SUM(CASE WHEN estado = 'reprogramada' THEN 1 ELSE 0 END)  AS reprogramadas,
         SUM(CASE WHEN estado = 'programada'   THEN 1 ELSE 0 END)  AS programadas
       FROM citas WHERE id_perfil = $1`,
      [perfilId],
    );

    const row          = result.rows[0];
    const total        = parseInt(row.total)        || 0;
    const atendidas    = parseInt(row.atendidas)    || 0;
    const canceladas   = parseInt(row.canceladas)   || 0;
    const reprogramadas = parseInt(row.reprogramadas) || 0;
    const programadas  = parseInt(row.programadas)  || 0;

    // El porcentaje de asistencia excluye citas programadas (aún no ocurrieron)
    const citasRealizadas = total - programadas;
    const pctAsistencia = citasRealizadas > 0
      ? Math.round((atendidas / citasRealizadas) * 100)
      : 0;

    return {
      total, atendidas, canceladas, reprogramadas, programadas, pct_asistencia: pctAsistencia,
    };
  },


  /**
   * Verifica si existe una cita en el mismo horario (para evitar conflictos).
   */
  async existsConflict(
    nutricionistaId: number,
    fechaHora:       string,
    excludeId?:      number,
  ): Promise<boolean> {

    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM citas
         WHERE id_nutricionista = $1
           AND estado = 'programada'
           AND fecha_hora BETWEEN ($2::timestamptz - INTERVAL '30 minutes')
                              AND ($2::timestamptz + INTERVAL '30 minutes')
           AND ($3::int IS NULL OR id_cita != $3)
       ) as exists`,
      [nutricionistaId, fechaHora, excludeId ?? null],
    );
    return result.rows[0].exists;
  },

};