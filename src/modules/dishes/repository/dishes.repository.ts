import { pool } from '@database/pool';

export interface PlatoRow {
  id_plato: number;
  nombre: string;
  descripcion: string | null;
  modo_preparacion: string | null;
  enlace_video: string | null;
  calorias_totales: number;
  proteinas_totales?: number;
  carbohidratos_totales?: number;
  grasas_totales?: number;
  tiempo_preparacion_min: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface IngredienteRow {
  id_plato_ingrediente: number;
  id_plato: number;
  id_alimento?: number | null;
  id_alimento_detalle?: number | null;
  cantidad_g: number;
  nombre?: string;
  calorias?: number;
  proteinas?: number | null;
  carbohidratos?: number | null;
  grasas?: number | null;
  fibra?: number | null;
  sodio?: number | null;
  calorias_aportadas?: number;  // calculado: (calorias * cantidad_g) / 100
}

export interface AptitudRow {
  id_aptitud: number;
  codigo: string;
  nombre: string;
}

export const dishesRepository = {

  async findAll(filters: {
    search?: string;
    activo?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: PlatoRow[]; total: number }> {

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.search) {
      conditions.push(`nombre ILIKE $${idx++}`);
      params.push(`%${filters.search}%`);
    }

    if (filters.activo !== undefined) {
      conditions.push(`activo = $${idx++}`);
      params.push(filters.activo === 'true');
    } else {
      conditions.push(`activo = TRUE`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM platos ${where}`,
      params,
    );

    const dataResult = await pool.query<PlatoRow>(
      `SELECT p.*,
              macros.proteinas_totales,
              macros.carbohidratos_totales,
              macros.grasas_totales
       FROM platos p
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(ROUND(SUM(COALESCE(ad.proteinas, 0) * pi.cantidad_g / 100)::numeric, 2), 0)::double precision AS proteinas_totales,
           COALESCE(ROUND(SUM(COALESCE(ad.carbohidratos, 0) * pi.cantidad_g / 100)::numeric, 2), 0)::double precision AS carbohidratos_totales,
           COALESCE(ROUND(SUM(COALESCE(ad.grasas, 0) * pi.cantidad_g / 100)::numeric, 2), 0)::double precision AS grasas_totales
         FROM plato_ingredientes pi
         LEFT JOIN alimentos_detalle ad
           ON ad.id_alimento_detalle = pi.id_alimento_detalle
         WHERE pi.id_plato = p.id_plato
       ) macros ON TRUE
       ${where}
       ORDER BY p.nombre ASC
       LIMIT $${idx++} OFFSET $${idx}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      rows: dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  },


  async findById(id: number): Promise<PlatoRow | null> {
    const result = await pool.query<PlatoRow>(
      `SELECT * FROM platos WHERE id_plato = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Obtiene el plato con todos sus ingredientes y calorías calculadas.
   */
  async findByIdWithIngredients(id: number): Promise<{
    plato: PlatoRow;
    ingredientes: IngredienteRow[];
    aptitudes: AptitudRow[];
  } | null> {

    const platoResult = await pool.query<PlatoRow>(
      `SELECT p.*,
              macros.proteinas_totales,
              macros.carbohidratos_totales,
              macros.grasas_totales
       FROM platos p
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(ROUND(SUM(COALESCE(ad.proteinas, 0) * pi.cantidad_g / 100)::numeric, 2), 0)::double precision AS proteinas_totales,
           COALESCE(ROUND(SUM(COALESCE(ad.carbohidratos, 0) * pi.cantidad_g / 100)::numeric, 2), 0)::double precision AS carbohidratos_totales,
           COALESCE(ROUND(SUM(COALESCE(ad.grasas, 0) * pi.cantidad_g / 100)::numeric, 2), 0)::double precision AS grasas_totales
         FROM plato_ingredientes pi
         LEFT JOIN alimentos_detalle ad
           ON ad.id_alimento_detalle = pi.id_alimento_detalle
         WHERE pi.id_plato = p.id_plato
       ) macros ON TRUE
       WHERE p.id_plato = $1`,
      [id],
    );

    if (!platoResult.rows[0]) return null;

    const [ingredientesResult, aptitudesResult] = await Promise.all([
      pool.query<IngredienteRow>(
        `SELECT
           pi.id_plato_ingrediente,
           pi.id_plato,
           pi.cantidad_g,
           pi.id_alimento_detalle,
           pi.id_alimento,
           COALESCE(ad.nombre, al.nombre) AS nombre,
           COALESCE(ad.calorias, al.calorias_por_100g) AS calorias,
           ad.proteinas,
           ad.carbohidratos,
           ad.grasas,
           ad.fibra,
           ad.sodio,
           ROUND((COALESCE(ad.calorias, al.calorias_por_100g)
             * pi.cantidad_g / 100)::numeric, 0)::integer AS calorias_aportadas
         FROM plato_ingredientes pi
         LEFT JOIN alimentos_detalle ad
           ON ad.id_alimento_detalle = pi.id_alimento_detalle
         LEFT JOIN alimentos al
           ON al.id_alimento = pi.id_alimento
         WHERE pi.id_plato = $1
         ORDER BY pi.id_plato_ingrediente ASC`,
        [id],
      ),
      pool.query<AptitudRow>(
        `SELECT ac.id_aptitud, ac.codigo, ac.nombre
         FROM plato_aptitudes pa
         JOIN aptitudes_clinicas ac ON ac.id_aptitud = pa.id_aptitud
         WHERE pa.id_plato = $1
         ORDER BY ac.id_aptitud ASC`,
        [id],
      ),
    ]);

    return {
      plato: platoResult.rows[0],
      ingredientes: ingredientesResult.rows,
      aptitudes: aptitudesResult.rows,
    };
  },


  /**
   * Crea un plato con sus ingredientes en una transacción.
   * Calcula calorias_totales sumando las de los ingredientes.
   */
  async create(data: {
    nombre: string;
    descripcion?: string | null;
    modo_preparacion?: string | null;
    enlace_video?: string | null;
    tiempo_preparacion_min?: number | null;
    ingredientes: Array<{
      id_alimento?: number | null;
      id_alimento_detalle?: number | null;
      cantidad_g: number;
    }>;
    aptitudes: number[];
    id_tiempo_comida?: number | null;
  }): Promise<{ plato: PlatoRow; ingredientes: IngredienteRow[] }> {

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Crear el plato con 0 calorías inicialmente
      const platoResult = await client.query<PlatoRow>(
        `INSERT INTO platos
          (nombre, descripcion, modo_preparacion, enlace_video,
            tiempo_preparacion_min, id_tiempo_comida)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          data.nombre,
          data.descripcion ?? null,
          data.modo_preparacion ?? null,
          data.enlace_video ?? null,
          data.tiempo_preparacion_min ?? null,
          data.id_tiempo_comida ?? null,
        ],
      );
      const plato = platoResult.rows[0];

      // 2. Insertar ingredientes y calcular calorías totales
      let caloriasTotal = 0;
      const ingredientesInsertados: IngredienteRow[] = [];

      for (const ing of data.ingredientes) {

        if (ing.id_alimento_detalle) {
          // Ingrediente de alimentos_detalle (constructor o IA)
          const alimentoResult = await client.query<{
            calorias: number; nombre: string;
          }>(
            `SELECT calorias, nombre FROM alimentos_detalle
       WHERE id_alimento_detalle = $1`,
            [ing.id_alimento_detalle],
          );
          if (!alimentoResult.rows[0]) continue;

          const caloriasIng = Math.round(
            (alimentoResult.rows[0].calorias * ing.cantidad_g) / 100
          );
          caloriasTotal += caloriasIng;

          const ingResult = await client.query<IngredienteRow>(
            `INSERT INTO plato_ingredientes
         (id_plato, id_alimento_detalle, cantidad_g)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [plato.id_plato, ing.id_alimento_detalle, ing.cantidad_g],
          );
          ingredientesInsertados.push({
            ...ingResult.rows[0],
            nombre: alimentoResult.rows[0].nombre,
            calorias: alimentoResult.rows[0].calorias,
            calorias_aportadas: caloriasIng,
          });

        } else if (ing.id_alimento) {
          // Ingrediente de alimentos (tabla pequeña, platos manuales legacy)
          const alimentoResult = await client.query<{
            calorias_por_100g: number; nombre: string;
          }>(
            `SELECT calorias_por_100g, nombre FROM alimentos
       WHERE id_alimento = $1`,
            [ing.id_alimento],
          );
          if (!alimentoResult.rows[0]) continue;

          const caloriasIng = Math.round(
            (alimentoResult.rows[0].calorias_por_100g * ing.cantidad_g) / 100
          );
          caloriasTotal += caloriasIng;

          const ingResult = await client.query<IngredienteRow>(
            `INSERT INTO plato_ingredientes
         (id_plato, id_alimento, cantidad_g)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [plato.id_plato, ing.id_alimento, ing.cantidad_g],
          );
          ingredientesInsertados.push({
            ...ingResult.rows[0],
            nombre: alimentoResult.rows[0].nombre,
            calorias: alimentoResult.rows[0].calorias_por_100g,
            calorias_aportadas: caloriasIng,
          });
        }
      }

      // 3. Insertar aptitudes clinicas seleccionadas
      for (const idAptitud of data.aptitudes) {
        await client.query(
          `INSERT INTO plato_aptitudes (id_plato, id_aptitud)
           VALUES ($1, $2)
           ON CONFLICT (id_plato, id_aptitud) DO NOTHING`,
          [plato.id_plato, idAptitud],
        );
      }

      // 4. Actualizar calorias_totales del plato
      const platoActualizado = await client.query<PlatoRow>(
        `UPDATE platos SET calorias_totales = $1, updated_at = NOW()
         WHERE id_plato = $2 RETURNING *`,
        [caloriasTotal, plato.id_plato],
      );

      await client.query('COMMIT');

      return {
        plato: platoActualizado.rows[0],
        ingredientes: ingredientesInsertados,
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },


  async update(id: number, data: Partial<{
    nombre: string;
    descripcion: string | null;
    modo_preparacion: string | null;
    enlace_video: string | null;
    tiempo_preparacion_min: number | null;
  }>): Promise<PlatoRow | null> {

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(data.nombre); }
    if (data.descripcion !== undefined) { fields.push(`descripcion = $${idx++}`); values.push(data.descripcion); }
    if (data.modo_preparacion !== undefined) { fields.push(`modo_preparacion = $${idx++}`); values.push(data.modo_preparacion); }
    if (data.enlace_video !== undefined) { fields.push(`enlace_video = $${idx++}`); values.push(data.enlace_video); }
    if (data.tiempo_preparacion_min !== undefined) { fields.push(`tiempo_preparacion_min = $${idx++}`); values.push(data.tiempo_preparacion_min); }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query<PlatoRow>(
      `UPDATE platos SET ${fields.join(', ')}
       WHERE id_plato = $${idx} RETURNING *`,
      values,
    );
    return result.rows[0] ?? null;
  },


  async setStatus(id: number, activo: boolean): Promise<PlatoRow | null> {
    const result = await pool.query<PlatoRow>(
      `UPDATE platos SET activo = $1, updated_at = NOW()
       WHERE id_plato = $2 RETURNING *`,
      [activo, id],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Agrega o actualiza un ingrediente en un plato y recalcula calorías totales.
   */
  async upsertIngredient(
    platoId: number,
    alimentoId: number,
    cantidadG: number,
  ): Promise<void> {

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insertar o actualizar el ingrediente
      await client.query(
        `INSERT INTO plato_ingredientes (id_plato, id_alimento, cantidad_g)
         VALUES ($1, $2, $3)
         ON CONFLICT (id_plato, id_alimento)
         DO UPDATE SET cantidad_g = EXCLUDED.cantidad_g`,
        [platoId, alimentoId, cantidadG],
      );

      // Recalcular y actualizar calorias_totales del plato
      await client.query(
        `UPDATE platos
         SET calorias_totales = (
           SELECT COALESCE(
             SUM(ROUND((a.calorias_por_100g::numeric * pi.cantidad_g) / 100, 0)),
             0
           )
           FROM plato_ingredientes pi
           JOIN alimentos          a ON a.id_alimento = pi.id_alimento
           WHERE pi.id_plato = $1
         ),
         updated_at = NOW()
         WHERE id_plato = $1`,
        [platoId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },


  /**
   * Elimina un ingrediente del plato y recalcula calorías.
   */
  async removeIngredient(platoId: number, ingredienteId: number): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `DELETE FROM plato_ingredientes
         WHERE id_plato = $1 AND id_plato_ingrediente = $2`,
        [platoId, ingredienteId],
      );

      await client.query(
        `UPDATE platos
         SET calorias_totales = (
           SELECT COALESCE(
             SUM(ROUND((a.calorias_por_100g::numeric * pi.cantidad_g) / 100, 0)), 0
           )
           FROM plato_ingredientes pi
           JOIN alimentos          a ON a.id_alimento = pi.id_alimento
           WHERE pi.id_plato = $1
         ),
         updated_at = NOW()
         WHERE id_plato = $1`,
        [platoId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },


  async delete(id: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `DELETE FROM plato_aptitudes WHERE id_plato = $1`,
        [id],
      );

      await client.query(
        `DELETE FROM plato_ingredientes WHERE id_plato = $1`,
        [id],
      );

      const result = await client.query<{ id_plato: number }>(
        `DELETE FROM platos WHERE id_plato = $1 RETURNING id_plato`,
        [id],
      );

      await client.query('COMMIT');
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },


  async existsByName(nombre: string, excludeId?: number): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM platos
         WHERE LOWER(nombre) = LOWER($1)
           AND ($2::int IS NULL OR id_plato != $2)
       ) as exists`,
      [nombre, excludeId ?? null],
    );
    return result.rows[0].exists;
  },

};