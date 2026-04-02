import { pool } from '@database/pool';

export interface PlanRow {
  id_plan:           number;
  id_perfil:         number;
  id_evaluacion:     number;
  id_nutricionista:  number;
  fecha_inicio:      string | null;
  fecha_fin:         string | null;
  estado:            string;
  modulo_habilitado: boolean;
  fecha_activacion:  string | null;
  fecha_suspension:  string | null;
  notas:             string | null;
  created_at:        string;
}

export interface SemanaRow {
  id_semana:           number;
  id_plan:             number;
  numero:              number;
  fecha_inicio_semana: string;
  fecha_fin_semana:    string;
}

export interface DiaPlanRow {
  id_dia_plan: number;
  id_semana:   number;
  dia_semana:  string;
  fecha:       string;
}

export interface MenuDiarioRow {
  id_menu_diario:     number;
  id_dia_plan:        number;
  id_tiempo_comida:   number;
  id_plato:           number;
  calorias_aportadas: number;
  nombre_tiempo?:     string;
  nombre_plato?:      string;
}

export interface EjercicioDiarioRow {
  id_ejercicio_diario: number;
  id_dia_plan:         number;
  id_ejercicio:        number;
  nombre_ejercicio?:   string;
  duracion_min?:       number;
  intensidad?:         string;
}

export const nutritionPlansRepository = {

  /**
   * Crea un nuevo plan nutricional en estado 'pendiente'.
   */
  async create(data: {
    id_perfil:        number;
    id_evaluacion:    number;
    id_nutricionista: number;
    notas?:           string | null;
  }): Promise<PlanRow> {
    const result = await pool.query<PlanRow>(
      `INSERT INTO planes_nutricionales
         (id_perfil, id_evaluacion, id_nutricionista, notas)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.id_perfil, data.id_evaluacion, data.id_nutricionista, data.notas ?? null],
    );
    return result.rows[0];
  },


  /**
   * Busca un plan por su ID.
   */
  async findById(planId: number): Promise<PlanRow | null> {
    const result = await pool.query<PlanRow>(
      `SELECT * FROM planes_nutricionales WHERE id_plan = $1`,
      [planId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Lista todos los planes de un paciente ordenados por fecha de creación.
   */
  async findByPatient(perfilId: number): Promise<PlanRow[]> {
    const result = await pool.query<PlanRow>(
      `SELECT * FROM planes_nutricionales
       WHERE  id_perfil = $1
       ORDER  BY created_at DESC`,
      [perfilId],
    );
    return result.rows;
  },


  /**
   * Obtiene el plan activo actual de un paciente.
   * Solo retorna plan si está activo, modulo_habilitado = true
   * y dentro del rango de fechas.
   */
  async findActivePlan(perfilId: number): Promise<PlanRow | null> {
    const result = await pool.query<PlanRow>(
      `SELECT * FROM planes_nutricionales
       WHERE  id_perfil        = $1
         AND  estado           = 'activo'
         AND  modulo_habilitado = TRUE
         AND  (fecha_fin IS NULL OR fecha_fin >= CURRENT_DATE)
       ORDER  BY fecha_activacion DESC
       LIMIT  1`,
      [perfilId],
    );
    return result.rows[0] ?? null;
  },


  /**
   * Activa un plan: cambia estado, establece fecha_inicio
   * y habilita el módulo Mi Plan.
   */
  async activate(planId: number, fechaInicio: string, fechaFin: string | null): Promise<PlanRow> {
    const result = await pool.query<PlanRow>(
      `UPDATE planes_nutricionales
       SET    estado            = 'activo',
              modulo_habilitado = TRUE,
              fecha_inicio      = $2,
              fecha_fin         = $3,
              fecha_activacion  = NOW(),
              updated_at        = NOW()
       WHERE  id_plan = $1
       RETURNING *`,
      [planId, fechaInicio, fechaFin ?? null],
    );
    return result.rows[0];
  },


  /**
   * Suspende un plan activo.
   */
  async suspend(planId: number): Promise<PlanRow> {
    const result = await pool.query<PlanRow>(
      `UPDATE planes_nutricionales
       SET    estado            = 'suspendido',
              modulo_habilitado = FALSE,
              fecha_suspension  = NOW(),
              updated_at        = NOW()
       WHERE  id_plan = $1
       RETURNING *`,
      [planId],
    );
    return result.rows[0];
  },


  /**
   * Reactiva un plan suspendido.
   */
  async reactivate(planId: number): Promise<PlanRow> {
    const result = await pool.query<PlanRow>(
      `UPDATE planes_nutricionales
       SET    estado            = 'activo',
              modulo_habilitado = TRUE,
              fecha_suspension  = NULL,
              updated_at        = NOW()
       WHERE  id_plan = $1
       RETURNING *`,
      [planId],
    );
    return result.rows[0];
  },


  /**
   * Bloquea el módulo Mi Plan sin cambiar el estado del plan.
   */
  async lockModule(planId: number): Promise<PlanRow> {
    const result = await pool.query<PlanRow>(
      `UPDATE planes_nutricionales
       SET    modulo_habilitado = FALSE,
              updated_at        = NOW()
       WHERE  id_plan = $1
       RETURNING *`,
      [planId],
    );
    return result.rows[0];
  },


  /**
   * Desbloquea el módulo Mi Plan.
   */
  async unlockModule(planId: number): Promise<PlanRow> {
    const result = await pool.query<PlanRow>(
      `UPDATE planes_nutricionales
       SET    modulo_habilitado = TRUE,
              updated_at        = NOW()
       WHERE  id_plan = $1
       RETURNING *`,
      [planId],
    );
    return result.rows[0];
  },


  // ── Semanas ──────────────────────────────────────────────────────────────


  /**
   * Crea una semana dentro del plan.
   */
  async createWeek(data: {
    id_plan:             number;
    numero:              number;
    fecha_inicio_semana: string;
    fecha_fin_semana:    string;
  }): Promise<SemanaRow> {
    const result = await pool.query<SemanaRow>(
      `INSERT INTO planes_semanales
         (id_plan, numero, fecha_inicio_semana, fecha_fin_semana)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.id_plan, data.numero, data.fecha_inicio_semana, data.fecha_fin_semana],
    );
    return result.rows[0];
  },


  /**
   * Lista las semanas de un plan.
   */
  async findWeeksByPlan(planId: number): Promise<SemanaRow[]> {
    const result = await pool.query<SemanaRow>(
      `SELECT * FROM planes_semanales
       WHERE  id_plan = $1
       ORDER  BY numero ASC`,
      [planId],
    );
    return result.rows;
  },


  /**
   * Busca una semana por su ID.
   */
  async findWeekById(weekId: number): Promise<SemanaRow | null> {
    const result = await pool.query<SemanaRow>(
      `SELECT * FROM planes_semanales WHERE id_semana = $1`,
      [weekId],
    );
    return result.rows[0] ?? null;
  },


  // ── Días del plan ─────────────────────────────────────────────────────────


  /**
   * Obtiene o crea un día dentro de una semana.
   * Si el día ya existe, lo retorna. Si no, lo crea.
   */
  async findOrCreateDay(weekId: number, diaSemana: string, fecha: string): Promise<DiaPlanRow> {
    // Intentar encontrar el día primero
    const existing = await pool.query<DiaPlanRow>(
      `SELECT * FROM dias_plan
       WHERE  id_semana  = $1
         AND  dia_semana = $2`,
      [weekId, diaSemana],
    );

    if (existing.rows[0]) return existing.rows[0];

    // Crear el día si no existe
    const result = await pool.query<DiaPlanRow>(
      `INSERT INTO dias_plan (id_semana, dia_semana, fecha)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [weekId, diaSemana, fecha],
    );
    return result.rows[0];
  },


  /**
   * Lista todos los días de una semana con sus menús y ejercicios.
   */
  async findDaysByWeek(weekId: number): Promise<DiaPlanRow[]> {
    const result = await pool.query<DiaPlanRow>(
      `SELECT * FROM dias_plan
       WHERE  id_semana = $1
       ORDER  BY fecha ASC`,
      [weekId],
    );
    return result.rows;
  },


  // ── Menús diarios ─────────────────────────────────────────────────────────


  /**
   * Asigna un menú (plato + tiempo de comida) a un día del plan.
   */
  async createMenu(data: {
    id_dia_plan:        number;
    id_tiempo_comida:   number;
    id_plato:           number;
    calorias_aportadas: number;
  }): Promise<MenuDiarioRow> {
    const result = await pool.query<MenuDiarioRow>(
      `INSERT INTO menus_diarios
         (id_dia_plan, id_tiempo_comida, id_plato, calorias_aportadas)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id_dia_plan, id_tiempo_comida)
       DO UPDATE SET
         id_plato           = EXCLUDED.id_plato,
         calorias_aportadas = EXCLUDED.calorias_aportadas,
         updated_at         = NOW()
       RETURNING *`,
      [data.id_dia_plan, data.id_tiempo_comida, data.id_plato, data.calorias_aportadas],
    );
    return result.rows[0];
  },


  /**
   * Lista los menús de un día con nombre del plato y tiempo de comida.
   */
  async findMenusByDay(diaPlanId: number): Promise<MenuDiarioRow[]> {
    const result = await pool.query<MenuDiarioRow>(
      `SELECT md.*,
              tc.nombre   AS nombre_tiempo,
              tc.orden,
              p.nombre    AS nombre_plato,
              p.descripcion AS descripcion_plato
       FROM   menus_diarios md
       JOIN   tiempos_comida tc ON tc.id_tiempo_comida = md.id_tiempo_comida
       JOIN   platos          p  ON p.id_plato         = md.id_plato
       WHERE  md.id_dia_plan = $1
       ORDER  BY tc.orden ASC`,
      [diaPlanId],
    );
    return result.rows;
  },


  // ── Ejercicios diarios ────────────────────────────────────────────────────


  /**
   * Asigna un ejercicio a un día del plan.
   */
  async createDailyExercise(data: {
    id_dia_plan:  number;
    id_ejercicio: number;
  }): Promise<EjercicioDiarioRow> {
    const result = await pool.query<EjercicioDiarioRow>(
      `INSERT INTO ejercicios_diarios (id_dia_plan, id_ejercicio)
       VALUES ($1, $2)
       ON CONFLICT (id_dia_plan, id_ejercicio) DO NOTHING
       RETURNING *`,
      [data.id_dia_plan, data.id_ejercicio],
    );
    return result.rows[0];
  },


  /**
   * Lista los ejercicios de un día con detalles del ejercicio.
   */
  async findExercisesByDay(diaPlanId: number): Promise<EjercicioDiarioRow[]> {
    const result = await pool.query<EjercicioDiarioRow>(
      `SELECT ed.*,
              e.nombre       AS nombre_ejercicio,
              e.duracion_min,
              e.intensidad,
              e.categoria,
              e.descripcion  AS descripcion_ejercicio
       FROM   ejercicios_diarios ed
       JOIN   ejercicios          e ON e.id_ejercicio = ed.id_ejercicio
       WHERE  ed.id_dia_plan = $1
       ORDER  BY e.nombre ASC`,
      [diaPlanId],
    );
    return result.rows;
  },


  /**
   * Elimina un ejercicio de un día del plan.
   */
  async removeDailyExercise(diaPlanId: number, ejercicioDiarioId: number): Promise<void> {
    await pool.query(
      `DELETE FROM ejercicios_diarios
       WHERE id_dia_plan         = $1
         AND id_ejercicio_diario = $2`,
      [diaPlanId, ejercicioDiarioId],
    );
  },


  /**
   * Obtiene el plan activo completo con semanas, días, menús y ejercicios.
   * Optimizado para la app móvil — una sola consulta estructurada.
   */
  async findActivePlanComplete(perfilId: number): Promise<{
    plan:    PlanRow;
    semanas: Array<{
      semana: SemanaRow;
      dias:   Array<{
        dia:       DiaPlanRow;
        menus:     MenuDiarioRow[];
        ejercicios: EjercicioDiarioRow[];
      }>;
    }>;
  } | null> {

    // Obtener el plan activo
    const plan = await this.findActivePlan(perfilId);
    if (!plan) return null;

    // Obtener semanas del plan
    const semanas = await this.findWeeksByPlan(plan.id_plan);

    // Para cada semana, obtener días con sus menús y ejercicios
    const semanasCompletas = await Promise.all(
      semanas.map(async semana => {
        const dias = await this.findDaysByWeek(semana.id_semana);

        const diasCompletos = await Promise.all(
          dias.map(async dia => {
            const [menus, ejercicios] = await Promise.all([
              this.findMenusByDay(dia.id_dia_plan),
              this.findExercisesByDay(dia.id_dia_plan),
            ]);
            return { dia, menus, ejercicios };
          })
        );

        return { semana, dias: diasCompletos };
      })
    );

    return { plan, semanas: semanasCompletas };
  },

};