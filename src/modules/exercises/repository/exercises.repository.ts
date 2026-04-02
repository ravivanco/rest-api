import { pool } from '@database/pool';

export interface EjercicioRow {
  id_ejercicio:                number;
  nombre:                      string;
  descripcion:                 string | null;
  categoria:                   string;
  duracion_min:                number;
  frecuencia_semanal:          number;
  intensidad:                  string;
  nivel_actividad_recomendado: string | null;
  objetivo_recomendado:        string | null;
  activo:                      boolean;
  created_at:                  string;
  updated_at:                  string;
}

export const exercisesRepository = {

  async findAll(filters: {
    search?:                     string;
    intensidad?:                 string;
    nivel_actividad_recomendado?: string;
    categoria?:                  string;
    activo?:                     string;
    limit:                       number;
    offset:                      number;
  }): Promise<{ rows: EjercicioRow[]; total: number }> {

    const conditions: string[] = [];
    const params:     unknown[] = [];
    let   idx = 1;

    if (filters.search) {
      conditions.push(`(nombre ILIKE $${idx} OR categoria ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    if (filters.intensidad) {
      conditions.push(`intensidad = $${idx++}`);
      params.push(filters.intensidad);
    }

    if (filters.nivel_actividad_recomendado) {
      conditions.push(`nivel_actividad_recomendado = $${idx++}`);
      params.push(filters.nivel_actividad_recomendado);
    }

    if (filters.categoria) {
      conditions.push(`categoria ILIKE $${idx++}`);
      params.push(`%${filters.categoria}%`);
    }

    if (filters.activo !== undefined) {
      conditions.push(`activo = $${idx++}`);
      params.push(filters.activo === 'true');
    } else {
      conditions.push(`activo = TRUE`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM ejercicios ${where}`,
      params,
    );

    const dataResult = await pool.query<EjercicioRow>(
      `SELECT * FROM ejercicios ${where}
       ORDER BY nombre ASC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      rows:  dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  },


  async findById(id: number): Promise<EjercicioRow | null> {
    const result = await pool.query<EjercicioRow>(
      `SELECT * FROM ejercicios WHERE id_ejercicio = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },


  async create(data: {
    nombre:                      string;
    descripcion?:                string | null;
    categoria:                   string;
    duracion_min:                number;
    frecuencia_semanal:          number;
    intensidad:                  string;
    nivel_actividad_recomendado?: string | null;
    objetivo_recomendado?:       string | null;
  }): Promise<EjercicioRow> {
    const result = await pool.query<EjercicioRow>(
      `INSERT INTO ejercicios
         (nombre, descripcion, categoria, duracion_min, frecuencia_semanal,
          intensidad, nivel_actividad_recomendado, objetivo_recomendado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.nombre, data.descripcion ?? null, data.categoria,
        data.duracion_min, data.frecuencia_semanal, data.intensidad,
        data.nivel_actividad_recomendado ?? null,
        data.objetivo_recomendado ?? null,
      ],
    );
    return result.rows[0];
  },


  async update(id: number, data: Partial<{
    nombre:                      string;
    descripcion:                 string | null;
    categoria:                   string;
    duracion_min:                number;
    frecuencia_semanal:          number;
    intensidad:                  string;
    nivel_actividad_recomendado: string | null;
    objetivo_recomendado:        string | null;
  }>): Promise<EjercicioRow | null> {

    const fields: string[] = [];
    const values: unknown[] = [];
    let   idx = 1;

    if (data.nombre                      !== undefined) { fields.push(`nombre = $${idx++}`);                      values.push(data.nombre); }
    if (data.descripcion                 !== undefined) { fields.push(`descripcion = $${idx++}`);                 values.push(data.descripcion); }
    if (data.categoria                   !== undefined) { fields.push(`categoria = $${idx++}`);                   values.push(data.categoria); }
    if (data.duracion_min                !== undefined) { fields.push(`duracion_min = $${idx++}`);                values.push(data.duracion_min); }
    if (data.frecuencia_semanal          !== undefined) { fields.push(`frecuencia_semanal = $${idx++}`);          values.push(data.frecuencia_semanal); }
    if (data.intensidad                  !== undefined) { fields.push(`intensidad = $${idx++}`);                  values.push(data.intensidad); }
    if (data.nivel_actividad_recomendado !== undefined) { fields.push(`nivel_actividad_recomendado = $${idx++}`); values.push(data.nivel_actividad_recomendado); }
    if (data.objetivo_recomendado        !== undefined) { fields.push(`objetivo_recomendado = $${idx++}`);        values.push(data.objetivo_recomendado); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query<EjercicioRow>(
      `UPDATE ejercicios SET ${fields.join(', ')}
       WHERE id_ejercicio = $${idx} RETURNING *`,
      values,
    );
    return result.rows[0] ?? null;
  },


  async setStatus(id: number, activo: boolean): Promise<EjercicioRow | null> {
    const result = await pool.query<EjercicioRow>(
      `UPDATE ejercicios SET activo = $1, updated_at = NOW()
       WHERE id_ejercicio = $2 RETURNING *`,
      [activo, id],
    );
    return result.rows[0] ?? null;
  },


  async existsByName(nombre: string, excludeId?: number): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM ejercicios
         WHERE LOWER(nombre) = LOWER($1)
           AND ($2::int IS NULL OR id_ejercicio != $2)
       ) as exists`,
      [nombre, excludeId ?? null],
    );
    return result.rows[0].exists;
  },

};