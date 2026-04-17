import { pool } from '@database/pool';

export interface EvaluacionRow {
  id_evaluacion:                   number;
  id_perfil:                       number;
  id_nutricionista:                number;
  fecha_evaluacion:                string;
  peso_kg:                         number;
  altura_cm:                       number;
  porcentaje_grasa:                number | null;
  masa_muscular_kg:                number | null;
  grasa_visceral:                  number | null;
  agua_corporal_pct:               number | null;
  masa_osea_kg:                    number | null;
  tmb_kcal:                        number | null;
  otros_indicadores:               Record<string, unknown> | null;
  calorias_diarias_calculadas:     number | null;
  distribucion_carbohidratos_pct:  number | null;
  distribucion_proteinas_pct:      number | null;
  distribucion_grasas_pct:         number | null;
  imc:                             number;
  created_at:                      string;
  // Datos del paciente (JOIN)
  nombres?:                        string;
  apellidos?:                      string;
  correo_institucional?:           string;
}

export const clinicalEvaluationsRepository = {

  /**
   * Registra una nueva evaluación clínica.
   * El IMC es calculado por PostgreSQL automáticamente.
   */
  async create(data: {
    id_perfil:                       number;
    id_nutricionista:                number;
    fecha_evaluacion:                string;
    peso_kg:                         number;
    altura_cm:                       number;
    porcentaje_grasa:                number | null;
    masa_muscular_kg:                number | null;
    grasa_visceral:                  number | null;
    agua_corporal_pct:               number | null;
    masa_osea_kg:                    number | null;
    tmb_kcal:                        number | null;
    otros_indicadores:               Record<string, unknown> | null;
    calorias_diarias_calculadas:     number;
    distribucion_carbohidratos_pct:  number;
    distribucion_proteinas_pct:      number;
    distribucion_grasas_pct:         number;
  }): Promise<EvaluacionRow> {

      `INSERT INTO evaluaciones_clinicas (
         id_perfil, id_nutricionista, fecha_evaluacion,
         peso_kg, altura_cm, porcentaje_grasa, masa_muscular_kg,
         grasa_visceral, agua_corporal_pct, masa_osea_kg, tmb_kcal,
         otros_indicadores, calorias_diarias_calculadas,
         distribucion_carbohidratos_pct, distribucion_proteinas_pct,
         distribucion_grasas_pct
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        data.id_perfil,
        data.id_nutricionista,
        data.fecha_evaluacion,
        data.peso_kg,
        data.altura_cm,
        data.porcentaje_grasa,
        data.masa_muscular_kg,
        data.grasa_visceral,
        data.agua_corporal_pct,
        data.masa_osea_kg,
        data.tmb_kcal,
        data.otros_indicadores ? JSON.stringify(data.otros_indicadores) : null,
        data.calorias_diarias_calculadas,
        data.distribucion_carbohidratos_pct,
        data.distribucion_proteinas_pct,
        data.distribucion_grasas_pct,
      ],
    );

    return result.rows[0];
  },


  /**
   * Lista el historial de evaluaciones de un paciente.
   * Ordenadas por fecha descendente (más reciente primero).
   */
  async findByPatient(perfilId: number): Promise<EvaluacionRow[]> {
    const result = await pool.query<EvaluacionRow>(
      `SELECT ec.*,
              u.nombres, u.apellidos, u.correo_institucional
       FROM   evaluaciones_clinicas ec
       JOIN   perfiles_paciente     pp ON pp.id_perfil = ec.id_perfil
       JOIN   usuarios              u  ON u.id_usuario = pp.id_usuario
       WHERE  ec.id_perfil = $1
       ORDER  BY ec.fecha_evaluacion DESC`,
      [perfilId],
    );
    return result.rows;
  },


  /**
   * Obtiene una evaluación por su ID con datos del paciente y nutricionista.
   */
  async findById(id: number): Promise<EvaluacionRow | null> {
    const result = await pool.query<EvaluacionRow>(
      `SELECT ec.*,
              up.nombres        AS nombres,
              up.apellidos      AS apellidos,
              up.correo_institucional,
              un.nombres        AS nutricionista_nombres,
              un.apellidos      AS nutricionista_apellidos
       FROM   evaluaciones_clinicas ec
       JOIN   perfiles_paciente     pp ON pp.id_perfil    = ec.id_perfil
       JOIN   usuarios              up ON up.id_usuario   = pp.id_usuario
       JOIN   usuarios              un ON un.id_usuario   = ec.id_nutricionista
       WHERE  ec.id_evaluacion = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Obtiene la última evaluación de un paciente.
   * Se usa para calcular la diferencia con la evaluación actual.
   */
  async findLatestByPatient(perfilId: number): Promise<EvaluacionRow | null> {
    const result = await pool.query<EvaluacionRow>(
      `SELECT * FROM evaluaciones_clinicas
       WHERE  id_perfil = $1
       ORDER  BY fecha_evaluacion DESC
       LIMIT  1`,
      [perfilId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Obtiene evaluaciones específicas por sus IDs para comparar.
   */
  async findByIds(ids: number[]): Promise<EvaluacionRow[]> {
    const result = await pool.query<EvaluacionRow>(
      `SELECT * FROM evaluaciones_clinicas
       WHERE  id_evaluacion = ANY($1::int[])
       ORDER  BY fecha_evaluacion ASC`,
      [ids],
    );
    return result.rows;
  },


  /**
   * Obtiene todas las evaluaciones de un paciente para calcular tendencias.
   * Mínimo necesario para gráficos: peso, IMC, % grasa, calorías.
   */
  async findTrendsByPatient(perfilId: number): Promise<{
    fecha_evaluacion:            string;
    peso_kg:                     number;
    imc:                         number;
    porcentaje_grasa:            number | null;
    masa_muscular_kg:            number | null;
    grasa_visceral:              number | null;
    agua_corporal_pct:           number | null;
    masa_osea_kg:                number | null;
    tmb_kcal:                    number | null;
    calorias_diarias_calculadas: number | null;
  }[]> {
    const result = await pool.query(
      `SELECT fecha_evaluacion, peso_kg, imc,
              porcentaje_grasa, masa_muscular_kg,
              grasa_visceral, agua_corporal_pct,
              masa_osea_kg, tmb_kcal,
              calorias_diarias_calculadas
       FROM   evaluaciones_clinicas
       WHERE  id_perfil = $1
       ORDER  BY fecha_evaluacion ASC`,
      [perfilId],
    );
    return result.rows;
  },


  /**
   * Verifica si una evaluación pertenece a un perfil específico.
   * Se usa para control de acceso.
   */
  async belongsToPatient(evaluationId: number, perfilId: number): Promise<boolean> {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM evaluaciones_clinicas
         WHERE  id_evaluacion = $1 AND id_perfil = $2
       ) as exists`,
      [evaluationId, perfilId],
    );
    return result.rows[0].exists;
  },

};