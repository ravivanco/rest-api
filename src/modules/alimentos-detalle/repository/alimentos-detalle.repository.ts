import { pool } from '@database/pool';

export interface AlimentoDetalleRow {
  id_alimento_detalle: number;
  nombre: string;
  categoria: string;
  calorias: number;
  proteinas: number | null;
  grasas: number | null;
  carbohidratos: number | null;
  fibra: number | null;
  ags: number | null;
  agm: number | null;
  agpi: number | null;
  colesterol: number | null;
  calcio: number | null;
  fosforo: number | null;
  hierro: number | null;
  potasio: number | null;
  sodio: number | null;
  zinc: number | null;
  vitamina_c: number | null;
  vitamina_a: number | null;
  folatos: number | null;
  vitamina_b12: number | null;
  fuente: string | null;
  created_at: string;
}

export const alimentosDetalleRepository = {
  async findAll(filters: {
    search?: string;
    categoria?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: AlimentoDetalleRow[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.search) {
      conditions.push(
        `immutable_unaccent(lower(nombre)) LIKE immutable_unaccent(lower($${idx++}))`,
      );
      params.push(`%${filters.search}%`);
    }

    if (filters.categoria) {
      conditions.push(`categoria = $${idx++}`);
      params.push(filters.categoria);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM alimentos_detalle ${where}`,
      params,
    );

    const dataResult = await pool.query<AlimentoDetalleRow>(
      `SELECT *
       FROM alimentos_detalle
       ${where}
       ORDER BY nombre ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
  },

  async findById(id: number): Promise<AlimentoDetalleRow | null> {
    const result = await pool.query<AlimentoDetalleRow>(
      `SELECT * FROM alimentos_detalle WHERE id_alimento_detalle = $1`,
      [id],
    );

    return result.rows[0] ?? null;
  },

  async create(data: {
    nombre: string;
    categoria: string;
    calorias: number;
    proteinas?: number | null;
    grasas?: number | null;
    carbohidratos?: number | null;
    fibra?: number | null;
    ags?: number | null;
    agm?: number | null;
    agpi?: number | null;
    colesterol?: number | null;
    calcio?: number | null;
    fosforo?: number | null;
    hierro?: number | null;
    potasio?: number | null;
    sodio?: number | null;
    zinc?: number | null;
    vitamina_c?: number | null;
    vitamina_a?: number | null;
    folatos?: number | null;
    vitamina_b12?: number | null;
    fuente?: string | null;
  }): Promise<AlimentoDetalleRow> {
    const result = await pool.query<AlimentoDetalleRow>(
      `INSERT INTO alimentos_detalle (
        nombre, categoria, calorias, proteinas, grasas, carbohidratos, fibra,
        ags, agm, agpi, colesterol, calcio, fosforo, hierro, potasio, sodio,
        zinc, vitamina_c, vitamina_a, folatos, vitamina_b12, fuente
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22
      )
      RETURNING *`,
      [
        data.nombre,
        data.categoria,
        data.calorias,
        data.proteinas ?? null,
        data.grasas ?? null,
        data.carbohidratos ?? null,
        data.fibra ?? null,
        data.ags ?? null,
        data.agm ?? null,
        data.agpi ?? null,
        data.colesterol ?? null,
        data.calcio ?? null,
        data.fosforo ?? null,
        data.hierro ?? null,
        data.potasio ?? null,
        data.sodio ?? null,
        data.zinc ?? null,
        data.vitamina_c ?? null,
        data.vitamina_a ?? null,
        data.folatos ?? null,
        data.vitamina_b12 ?? null,
        data.fuente ?? null,
      ],
    );

    return result.rows[0];
  },

  async update(id: number, data: Partial<{
    nombre: string;
    categoria: string;
    calorias: number;
    proteinas: number | null;
    grasas: number | null;
    carbohidratos: number | null;
    fibra: number | null;
    ags: number | null;
    agm: number | null;
    agpi: number | null;
    colesterol: number | null;
    calcio: number | null;
    fosforo: number | null;
    hierro: number | null;
    potasio: number | null;
    sodio: number | null;
    zinc: number | null;
    vitamina_c: number | null;
    vitamina_a: number | null;
    folatos: number | null;
    vitamina_b12: number | null;
    fuente: string | null;
  }>): Promise<AlimentoDetalleRow | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.categoria !== undefined) { fields.push(`categoria = $${idx++}`); values.push(data.categoria); }
    if (data.calorias !== undefined) { fields.push(`calorias = $${idx++}`); values.push(data.calorias); }
    if (data.proteinas !== undefined) { fields.push(`proteinas = $${idx++}`); values.push(data.proteinas); }
    if (data.grasas !== undefined) { fields.push(`grasas = $${idx++}`); values.push(data.grasas); }
    if (data.carbohidratos !== undefined) { fields.push(`carbohidratos = $${idx++}`); values.push(data.carbohidratos); }
    if (data.fibra !== undefined) { fields.push(`fibra = $${idx++}`); values.push(data.fibra); }
    if (data.ags !== undefined) { fields.push(`ags = $${idx++}`); values.push(data.ags); }
    if (data.agm !== undefined) { fields.push(`agm = $${idx++}`); values.push(data.agm); }
    if (data.agpi !== undefined) { fields.push(`agpi = $${idx++}`); values.push(data.agpi); }
    if (data.colesterol !== undefined) { fields.push(`colesterol = $${idx++}`); values.push(data.colesterol); }
    if (data.calcio !== undefined) { fields.push(`calcio = $${idx++}`); values.push(data.calcio); }
    if (data.fosforo !== undefined) { fields.push(`fosforo = $${idx++}`); values.push(data.fosforo); }
    if (data.hierro !== undefined) { fields.push(`hierro = $${idx++}`); values.push(data.hierro); }
    if (data.potasio !== undefined) { fields.push(`potasio = $${idx++}`); values.push(data.potasio); }
    if (data.sodio !== undefined) { fields.push(`sodio = $${idx++}`); values.push(data.sodio); }
    if (data.zinc !== undefined) { fields.push(`zinc = $${idx++}`); values.push(data.zinc); }
    if (data.vitamina_c !== undefined) { fields.push(`vitamina_c = $${idx++}`); values.push(data.vitamina_c); }
    if (data.vitamina_a !== undefined) { fields.push(`vitamina_a = $${idx++}`); values.push(data.vitamina_a); }
    if (data.folatos !== undefined) { fields.push(`folatos = $${idx++}`); values.push(data.folatos); }
    if (data.vitamina_b12 !== undefined) { fields.push(`vitamina_b12 = $${idx++}`); values.push(data.vitamina_b12); }
    if (data.fuente !== undefined) { fields.push(`fuente = $${idx++}`); values.push(data.fuente); }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await pool.query<AlimentoDetalleRow>(
      `UPDATE alimentos_detalle
       SET ${fields.join(', ')}
       WHERE id_alimento_detalle = $${idx}
       RETURNING *`,
      values,
    );

    return result.rows[0] ?? null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM alimentos_detalle WHERE id_alimento_detalle = $1`,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  },
};
