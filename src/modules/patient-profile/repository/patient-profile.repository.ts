import { pool } from '@database/pool';

export interface PerfilCompletoRow {
  id_perfil:                   number;
  id_usuario:                  number;
  nivel_actividad_fisica:      string;
  objetivo:                    string | null;
  alergias_intolerancias:      string | null;
  restricciones_alimenticias:  string | null;
  formulario_completado:       boolean;
  fecha_ultima_actualizacion:  string;
}

export interface CondicionRow {
  id_condicion: number;
  nombre:       string;
  descripcion:  string;
}

export interface PreferenciaRow {
  id_preferencia: number;
  id_alimento:    number;
  nombre_alimento: string;
  tipo:           string;
}

export interface DeporteRow {
  id_actividad_interes: number;
  deporte:              string;
}

export const patientProfileRepository = {

  /**
   * Obtiene el perfil básico de un paciente por su id_usuario.
   */
  async findByUserId(userId: number): Promise<PerfilCompletoRow | null> {
    const result = await pool.query<PerfilCompletoRow>(
      `SELECT id_perfil, id_usuario, nivel_actividad_fisica,
              objetivo, alergias_intolerancias, restricciones_alimenticias,
              formulario_completado, fecha_ultima_actualizacion
       FROM   perfiles_paciente
       WHERE  id_usuario = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Obtiene el perfil por id_perfil.
   */
  async findByPerfilId(perfilId: number): Promise<PerfilCompletoRow | null> {
    const result = await pool.query<PerfilCompletoRow>(
      `SELECT id_perfil, id_usuario, nivel_actividad_fisica,
              objetivo, alergias_intolerancias, restricciones_alimenticias,
              formulario_completado, fecha_ultima_actualizacion
       FROM   perfiles_paciente
       WHERE  id_perfil = $1`,
      [perfilId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Obtiene las condiciones médicas de un perfil.
   */
  async findCondiciones(perfilId: number): Promise<CondicionRow[]> {
    const result = await pool.query<CondicionRow>(
      `SELECT cm.id_condicion, cm.nombre, cm.descripcion
       FROM   paciente_condiciones pc
       JOIN   condiciones_medicas  cm ON cm.id_condicion = pc.id_condicion
       WHERE  pc.id_perfil = $1
       ORDER  BY cm.nombre`,
      [perfilId],
    );
    return result.rows;
  },


  /**
   * Obtiene las preferencias alimenticias de un perfil.
   */
  async findPreferencias(perfilId: number): Promise<PreferenciaRow[]> {
    const result = await pool.query<PreferenciaRow>(
      `SELECT pa.id_preferencia, pa.id_alimento,
              a.nombre AS nombre_alimento, pa.tipo
       FROM   preferencias_alimenticias pa
       JOIN   alimentos                 a  ON a.id_alimento = pa.id_alimento
       WHERE  pa.id_perfil = $1
       ORDER  BY pa.tipo, a.nombre`,
      [perfilId],
    );
    return result.rows;
  },


  /**
   * Obtiene los deportes de interés de un perfil.
   */
  async findDeportes(perfilId: number): Promise<DeporteRow[]> {
    const result = await pool.query<DeporteRow>(
      `SELECT id_actividad_interes, deporte
       FROM   actividades_fisicas_intereses
       WHERE  id_perfil = $1
       ORDER  BY deporte`,
      [perfilId],
    );
    return result.rows;
  },


  /**
   * Obtiene el catálogo de condiciones médicas disponibles.
   */
  async findCatalogoCondiciones(): Promise<CondicionRow[]> {
    const result = await pool.query<CondicionRow>(
      `SELECT id_condicion, nombre, descripcion
       FROM   condiciones_medicas
       WHERE  activo = TRUE
       ORDER  BY nombre`,
    );
    return result.rows;
  },


  /**
   * Guarda el formulario completo del paciente en una transacción.
   * Actualiza datos principales + reemplaza condiciones, preferencias y deportes.
   */
  async saveFullForm(perfilId: number, data: {
    nivel_actividad_fisica:     string;
    objetivo:                   string;
    alergias_intolerancias:     string | null;
    restricciones_alimenticias: string | null;
    condiciones:                number[];
    alimentos_preferidos:       number[];
    alimentos_restringidos:     number[];
    deportes:                   string[];
  }): Promise<void> {

    const client = await pool.connect();

    try {
      // Trazas de depuracion: permiten ubicar exactamente en que paso falla la transaccion.
      // En Render estos logs ayudan a ver si el error ocurre en UPDATE, DELETE, INSERT o COMMIT.
      // Se mantienen simples para no exponer datos sensibles completos.
      console.log('[patient-profile][saveFullForm] start', {
        perfilId,
        condiciones: data.condiciones.length,
        alimentos_preferidos: data.alimentos_preferidos.length,
        alimentos_restringidos: data.alimentos_restringidos.length,
        deportes: data.deportes.length,
      });

      await client.query('BEGIN');
      console.log('[patient-profile][saveFullForm] transaction begin', { perfilId });

      // 1. Actualizar datos principales del perfil
      const updateResult = await client.query(
        `UPDATE perfiles_paciente
         SET    nivel_actividad_fisica      = $1,
                objetivo                   = $2,
                alergias_intolerancias     = $3,
                restricciones_alimenticias = $4,
                formulario_completado      = TRUE,
                fecha_ultima_actualizacion = NOW()
         WHERE  id_perfil = $5`,
        [
          data.nivel_actividad_fisica,
          data.objetivo,
          data.alergias_intolerancias,
          data.restricciones_alimenticias,
          perfilId,
        ],
      );
      console.log('[patient-profile][saveFullForm] perfil updated', {
        perfilId,
        rowCount: updateResult.rowCount,
      });

      // 2. Reemplazar condiciones médicas (borrar las anteriores e insertar las nuevas)
      const deleteCondiciones = await client.query(
        `DELETE FROM paciente_condiciones WHERE id_perfil = $1`,
        [perfilId],
      );
      console.log('[patient-profile][saveFullForm] condiciones deleted', {
        perfilId,
        rowCount: deleteCondiciones.rowCount,
      });

      for (const idCondicion of data.condiciones) {
        const condicionResult = await client.query(
          `INSERT INTO paciente_condiciones (id_perfil, id_condicion)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [perfilId, idCondicion],
        );
        console.log('[patient-profile][saveFullForm] condicion inserted', {
          perfilId,
          idCondicion,
          rowCount: condicionResult.rowCount,
        });
      }

      // 3. Reemplazar preferencias alimenticias
      const deletePreferencias = await client.query(
        `DELETE FROM preferencias_alimenticias WHERE id_perfil = $1`,
        [perfilId],
      );
      console.log('[patient-profile][saveFullForm] preferencias deleted', {
        perfilId,
        rowCount: deletePreferencias.rowCount,
      });

      for (const idAlimento of data.alimentos_preferidos) {
        const preferidoResult = await client.query(
          `INSERT INTO preferencias_alimenticias (id_perfil, id_alimento, tipo)
           VALUES ($1, $2, 'preferido')
           ON CONFLICT DO NOTHING`,
          [perfilId, idAlimento],
        );
        console.log('[patient-profile][saveFullForm] alimento preferido inserted', {
          perfilId,
          idAlimento,
          rowCount: preferidoResult.rowCount,
        });
      }

      for (const idAlimento of data.alimentos_restringidos) {
        const restringidoResult = await client.query(
          `INSERT INTO preferencias_alimenticias (id_perfil, id_alimento, tipo)
           VALUES ($1, $2, 'restringido')
           ON CONFLICT DO NOTHING`,
          [perfilId, idAlimento],
        );
        console.log('[patient-profile][saveFullForm] alimento restringido inserted', {
          perfilId,
          idAlimento,
          rowCount: restringidoResult.rowCount,
        });
      }

      // 4. Reemplazar deportes de interés
      const deleteDeportes = await client.query(
        `DELETE FROM actividades_fisicas_intereses WHERE id_perfil = $1`,
        [perfilId],
      );
      console.log('[patient-profile][saveFullForm] deportes deleted', {
        perfilId,
        rowCount: deleteDeportes.rowCount,
      });

      for (const deporte of data.deportes) {
        const deporteResult = await client.query(
          `INSERT INTO actividades_fisicas_intereses (id_perfil, deporte)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [perfilId, deporte],
        );
        console.log('[patient-profile][saveFullForm] deporte inserted', {
          perfilId,
          deporte,
          rowCount: deporteResult.rowCount,
        });
      }

      await client.query('COMMIT');
      console.log('[patient-profile][saveFullForm] commit ok', { perfilId });

    } catch (error) {
      const pgError = error as {
        code?: string;
        constraint?: string;
        table?: string;
        detail?: string;
        schema?: string;
        where?: string;
        message?: string;
      };

      console.error('[patient-profile][saveFullForm] error', {
        perfilId,
        code: pgError.code,
        constraint: pgError.constraint,
        table: pgError.table,
        detail: pgError.detail,
        schema: pgError.schema,
        where: pgError.where,
        message: pgError.message,
      });

      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },


  /**
   * Sincronizacion incremental del formulario: actualiza solo los campos recibidos.
   * Mantiene consistencia en una transaccion y recalcula formulario_completado.
   */
  async saveSyncForm(perfilId: number, data: {
    nivel_actividad_fisica?: string;
    objetivo?: string;
    alergias_intolerancias?: string | null;
    restricciones_alimenticias?: string | null;
    condiciones?: number[];
    alimentos_preferidos?: number[];
    alimentos_restringidos?: number[];
    deportes?: string[];
  }): Promise<void> {

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const setClauses: string[] = [];
      const values: Array<string | null> = [];

      if (Object.prototype.hasOwnProperty.call(data, 'nivel_actividad_fisica')) {
        values.push(data.nivel_actividad_fisica ?? null);
        setClauses.push(`nivel_actividad_fisica = $${values.length}`);
      }

      if (Object.prototype.hasOwnProperty.call(data, 'objetivo')) {
        values.push(data.objetivo ?? null);
        setClauses.push(`objetivo = $${values.length}`);
      }

      if (Object.prototype.hasOwnProperty.call(data, 'alergias_intolerancias')) {
        values.push(data.alergias_intolerancias ?? null);
        setClauses.push(`alergias_intolerancias = $${values.length}`);
      }

      if (Object.prototype.hasOwnProperty.call(data, 'restricciones_alimenticias')) {
        values.push(data.restricciones_alimenticias ?? null);
        setClauses.push(`restricciones_alimenticias = $${values.length}`);
      }

      if (setClauses.length > 0) {
        values.push(String(perfilId));
        await client.query(
          `UPDATE perfiles_paciente
           SET ${setClauses.join(', ')},
               fecha_ultima_actualizacion = NOW()
           WHERE id_perfil = $${values.length}`,
          values,
        );
      }

      if (Object.prototype.hasOwnProperty.call(data, 'condiciones')) {
        await client.query(
          `DELETE FROM paciente_condiciones WHERE id_perfil = $1`,
          [perfilId],
        );

        for (const idCondicion of data.condiciones ?? []) {
          await client.query(
            `INSERT INTO paciente_condiciones (id_perfil, id_condicion)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [perfilId, idCondicion],
          );
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(data, 'alimentos_preferidos') ||
        Object.prototype.hasOwnProperty.call(data, 'alimentos_restringidos')
      ) {
        await client.query(
          `DELETE FROM preferencias_alimenticias WHERE id_perfil = $1`,
          [perfilId],
        );

        for (const idAlimento of data.alimentos_preferidos ?? []) {
          await client.query(
            `INSERT INTO preferencias_alimenticias (id_perfil, id_alimento, tipo)
             VALUES ($1, $2, 'preferido')
             ON CONFLICT DO NOTHING`,
            [perfilId, idAlimento],
          );
        }

        for (const idAlimento of data.alimentos_restringidos ?? []) {
          await client.query(
            `INSERT INTO preferencias_alimenticias (id_perfil, id_alimento, tipo)
             VALUES ($1, $2, 'restringido')
             ON CONFLICT DO NOTHING`,
            [perfilId, idAlimento],
          );
        }
      }

      if (Object.prototype.hasOwnProperty.call(data, 'deportes')) {
        await client.query(
          `DELETE FROM actividades_fisicas_intereses WHERE id_perfil = $1`,
          [perfilId],
        );

        for (const deporte of data.deportes ?? []) {
          await client.query(
            `INSERT INTO actividades_fisicas_intereses (id_perfil, deporte)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [perfilId, deporte],
          );
        }
      }

      await client.query(
        `UPDATE perfiles_paciente
         SET formulario_completado = (
           objetivo IS NOT NULL
           AND BTRIM(objetivo) <> ''
         )
         WHERE id_perfil = $1`,
        [perfilId],
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
   * Agrega una condición médica individual al perfil.
   */
  async addCondicion(perfilId: number, idCondicion: number): Promise<void> {
    await pool.query(
      `INSERT INTO paciente_condiciones (id_perfil, id_condicion)
       VALUES ($1, $2)
       ON CONFLICT (id_perfil, id_condicion) DO NOTHING`,
      [perfilId, idCondicion],
    );
  },


  /**
   * Elimina una condición médica del perfil.
   */
  async removeCondicion(perfilId: number, idCondicion: number): Promise<void> {
    await pool.query(
      `DELETE FROM paciente_condiciones
       WHERE id_perfil = $1 AND id_condicion = $2`,
      [perfilId, idCondicion],
    );
  },


  /**
   * Agrega una preferencia alimenticia al perfil.
   */
  async addPreferencia(perfilId: number, idAlimento: number, tipo: string): Promise<void> {
    await pool.query(
      `INSERT INTO preferencias_alimenticias (id_perfil, id_alimento, tipo)
       VALUES ($1, $2, $3)
       ON CONFLICT (id_perfil, id_alimento, tipo) DO NOTHING`,
      [perfilId, idAlimento, tipo],
    );
  },


  /**
   * Elimina una preferencia alimenticia del perfil.
   */
  async removePreferencia(perfilId: number, idPreferencia: number): Promise<void> {
    await pool.query(
      `DELETE FROM preferencias_alimenticias
       WHERE id_perfil = $1 AND id_preferencia = $2`,
      [perfilId, idPreferencia],
    );
  },


  /**
   * Agrega un deporte de interés al perfil.
   */
  async addDeporte(perfilId: number, deporte: string): Promise<void> {
    await pool.query(
      `INSERT INTO actividades_fisicas_intereses (id_perfil, deporte)
       VALUES ($1, $2)
       ON CONFLICT (id_perfil, deporte) DO NOTHING`,
      [perfilId, deporte],
    );
  },


  /**
   * Elimina un deporte de interés del perfil.
   */
  async removeDeporte(perfilId: number, idActividad: number): Promise<void> {
    await pool.query(
      `DELETE FROM actividades_fisicas_intereses
       WHERE id_perfil = $1 AND id_actividad_interes = $2`,
      [perfilId, idActividad],
    );
  },

};