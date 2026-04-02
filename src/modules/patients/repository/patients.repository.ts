import { pool } from '@database/pool';

export interface PatientRow {
  id_usuario:             number;
  correo_institucional:   string;
  nombres:                string;
  apellidos:              string;
  edad:                   number;
  sexo:                   string;
  fecha_nacimiento:       string;
  estado:                 string;
  fecha_registro:         string;
  id_perfil:              number;
  nivel_actividad_fisica: string;
  formulario_completado:  boolean;
}

export interface PatientSummaryRow {
  id_usuario:                   number;
  nombre_completo:              string;
  correo_institucional:         string;
  id_perfil:                    number;
  nivel_actividad_fisica:       string;
  formulario_completado:        boolean;
  id_plan:                      number | null;
  estado_plan:                  string | null;
  modulo_habilitado:            boolean | null;
  ultima_evaluacion:            string | null;
  ultimo_peso_clinico:          number | null;
  ultimo_imc:                   number | null;
  calorias_objetivo:            number | null;
  ultimo_peso_diario:           number | null;
  fecha_ultimo_peso:            string | null;
  nivel_adherencia:             string | null;
  pct_cumplimiento_alimenticio: number | null;
  pct_cumplimiento_ejercicio:   number | null;
}

export const patientsRepository = {

  /**
   * Lista pacientes con filtros opcionales y paginación.
   * Usa la vista v_resumen_paciente para traer datos consolidados.
   */
  async findAll(filters: {
    search?:               string;
    estado_plan?:          string;
    adherencia?:           string;
    formulario_completado?: string;
    limit:                 number;
    offset:                number;
  }): Promise<{ rows: PatientSummaryRow[]; total: number }> {

    // Construir condiciones dinámicamente según filtros recibidos
    const conditions: string[] = [];
    const params:     unknown[] = [];
    let   paramIndex = 1;

    if (filters.search) {
      conditions.push(
        `(nombre_completo ILIKE $${paramIndex} OR correo_institucional ILIKE $${paramIndex})`
      );
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.estado_plan) {
      conditions.push(`estado_plan = $${paramIndex}`);
      params.push(filters.estado_plan);
      paramIndex++;
    }

    if (filters.adherencia) {
      conditions.push(`nivel_adherencia = $${paramIndex}`);
      params.push(filters.adherencia);
      paramIndex++;
    }

    if (filters.formulario_completado !== undefined) {
      conditions.push(`formulario_completado = $${paramIndex}`);
      params.push(filters.formulario_completado === 'true');
      paramIndex++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Contar total para la paginación
    const countResult = await pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM v_resumen_paciente ${whereClause}`,
      params,
    );

    // Obtener la página solicitada
    const dataResult = await pool.query<PatientSummaryRow>(
      `SELECT * FROM v_resumen_paciente
       ${whereClause}
       ORDER BY nombre_completo ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, filters.limit, filters.offset],
    );

    return {
      rows:  dataResult.rows,
      total: parseInt(countResult.rows[0].total),
    };
  },


  /**
   * Obtiene la ficha completa de un paciente por su id_usuario.
   */
  async findById(userId: number): Promise<PatientSummaryRow | null> {
    const result = await pool.query<PatientSummaryRow>(
      `SELECT * FROM v_resumen_paciente WHERE id_usuario = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Obtiene los datos básicos del paciente por su id_perfil.
   * Útil para que el paciente vea sus propios datos desde la app móvil.
   */
  async findByPerfilId(perfilId: number): Promise<PatientSummaryRow | null> {
    const result = await pool.query<PatientSummaryRow>(
      `SELECT * FROM v_resumen_paciente WHERE id_perfil = $1`,
      [perfilId],
    );
    return result.rows[0] ?? null;
  },

};