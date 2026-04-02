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
      await client.query('BEGIN');

      // 1. Actualizar datos principales del perfil
      await client.query(
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

      // 2. Reemplazar condiciones médicas (borrar las anteriores e insertar las nuevas)
      await client.query(
        `DELETE FROM paciente_condiciones WHERE id_perfil = $1`,
        [perfilId],
      );

      for (const idCondicion of data.condiciones) {
        await client.query(
          `INSERT INTO paciente_condiciones (id_perfil, id_condicion)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [perfilId, idCondicion],
        );
      }

      // 3. Reemplazar preferencias alimenticias
      await client.query(
        `DELETE FROM preferencias_alimenticias WHERE id_perfil = $1`,
        [perfilId],
      );

      for (const idAlimento of data.alimentos_preferidos) {
        await client.query(
          `INSERT INTO preferencias_alimenticias (id_perfil, id_alimento, tipo)
           VALUES ($1, $2, 'preferido')
           ON CONFLICT DO NOTHING`,
          [perfilId, idAlimento],
        );
      }

      for (const idAlimento of data.alimentos_restringidos) {
        await client.query(
          `INSERT INTO preferencias_alimenticias (id_perfil, id_alimento, tipo)
           VALUES ($1, $2, 'restringido')
           ON CONFLICT DO NOTHING`,
          [perfilId, idAlimento],
        );
      }

      // 4. Reemplazar deportes de interés
      await client.query(
        `DELETE FROM actividades_fisicas_intereses WHERE id_perfil = $1`,
        [perfilId],
      );

      for (const deporte of data.deportes) {
        await client.query(
          `INSERT INTO actividades_fisicas_intereses (id_perfil, deporte)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [perfilId, deporte],
        );
      }

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