import { pool } from '@database/pool';

export interface AlimentoRow {
  id_alimento: number;
  nombre: string;
  categoria: string;
  calorias_por_100g: number;
  carbohidratos_g: number;
  proteinas_g: number;
  grasas_g: number;
  vitaminas: string | null;
  minerales: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export const foodsRepository = {

  /**
   * Lista alimentos con filtros y paginación.
   */
  async findAll(filters: {
    search?: string;
    categoria?: string;
    activo?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: AlimentoRow[]; total: number }> {

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.search) {
      conditions.push(`nombre ILIKE $${idx++}`);
      params.push(`%${filters.search}%`);
    }

    if (filters.categoria) {
      conditions.push(`categoria = $${idx++}`);
      params.push(filters.categoria);
    }

    // Por defecto muestra solo activos; si piden activo=false muestra inactivos
    if (filters.activo !== undefined) {
      conditions.push(`activo = $${idx++}`);
      params.push(filters.activo === 'true');
    } else {
      conditions.push(`activo = TRUE`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM alimentos ${where}`,
      params,
    );

    const dataResult = await pool.query<AlimentoRow>(
      `SELECT * FROM alimentos ${where}
       ORDER BY nombre ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  },


  async findById(id: number): Promise<AlimentoRow | null> {
    const result = await pool.query<AlimentoRow>(
      `SELECT * FROM alimentos WHERE id_alimento = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },


  async create(data: {
    nombre: string;
    categoria: string;
    calorias_por_100g: number;
    carbohidratos_g: number;
    proteinas_g: number;
    grasas_g: number;
    vitaminas?: string | null;
    minerales?: string | null;
    imagen_url?: string | null;        // ← NUEVO
    imagen_public_id?: string | null;        // ← NUEVO
  }): Promise<AlimentoRow> {
    const result = await pool.query<AlimentoRow>(
      `INSERT INTO alimentos
       (nombre, categoria, calorias_por_100g, carbohidratos_g,
        proteinas_g, grasas_g, vitaminas, minerales,
        imagen_url, imagen_public_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
      [
        data.nombre, data.categoria, data.calorias_por_100g,
        data.carbohidratos_g, data.proteinas_g, data.grasas_g,
        data.vitaminas ?? null, data.minerales ?? null,
        data.imagen_url ?? null,        // ← NUEVO
        data.imagen_public_id ?? null,  // ← NUEVO
      ],
    );
    return result.rows[0];
  },

  async update(id: number, data: Partial<{
    nombre: string;
    categoria: string;
    calorias_por_100g: number;
    carbohidratos_g: number;
    proteinas_g: number;
    grasas_g: number;
    vitaminas: string | null;
    minerales: string | null;
  }>): Promise<AlimentoRow | null> {

    // Construir SET dinámico — solo actualiza los campos enviados
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.categoria !== undefined) { fields.push(`categoria = $${idx++}`); values.push(data.categoria); }
    if (data.calorias_por_100g !== undefined) { fields.push(`calorias_por_100g = $${idx++}`); values.push(data.calorias_por_100g); }
    if (data.carbohidratos_g !== undefined) { fields.push(`carbohidratos_g = $${idx++}`); values.push(data.carbohidratos_g); }
    if (data.proteinas_g !== undefined) { fields.push(`proteinas_g = $${idx++}`); values.push(data.proteinas_g); }
    if (data.grasas_g !== undefined) { fields.push(`grasas_g = $${idx++}`); values.push(data.grasas_g); }
    if (data.vitaminas !== undefined) { fields.push(`vitaminas = $${idx++}`); values.push(data.vitaminas); }
    if (data.minerales !== undefined) { fields.push(`minerales = $${idx++}`); values.push(data.minerales); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query<AlimentoRow>(
      `UPDATE alimentos SET ${fields.join(', ')}
       WHERE id_alimento = $${idx}
       RETURNING *`,
      values,
    );
    return result.rows[0] ?? null;
  },


  /**
   * Activa o desactiva un alimento (nunca se elimina físicamente).
   */
  async setStatus(id: number, activo: boolean): Promise<AlimentoRow | null> {
    const result = await pool.query<AlimentoRow>(
      `UPDATE alimentos SET activo = $1, updated_at = NOW()
       WHERE id_alimento = $2 RETURNING *`,
      [activo, id],
    );
    return result.rows[0] ?? null;
  },


  async existsByName(nombre: string, excludeId?: number): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM alimentos
         WHERE  LOWER(nombre) = LOWER($1)
           AND  ($2::int IS NULL OR id_alimento != $2)
       ) as exists`,
      [nombre, excludeId ?? null],
    );
    return result.rows[0].exists;
  },

};