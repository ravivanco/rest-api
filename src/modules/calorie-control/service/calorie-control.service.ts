import { calorieControlRepository, ControlCaloricoRow } from '../repository/calorie-control.repository';
import { pool }                     from '@database/pool';
import { mealTrackingRepository }   from '../../meal-tracking/repository/meal-tracking.repository';
import { additionalIntakeRepository } from '../../additional-intake/repository/additional-intake.repository';

export const calorieControlService = {

  /**
   * Obtiene el dashboard de control calórico para una fecha específica (o hoy por defecto).
   * Contiene el balance total, comidas del plan y consumos adicionales registrados.
   */
  async getDashboardData(perfilId: number, targetDateStr?: string) {
    // 1. Obtener la fecha de consulta (usar fecha del servidor de BD por defecto)
    let fecha = targetDateStr;
    if (!fecha) {
      const dbDateResult = await pool.query<{ hoy: string }>('SELECT CURRENT_DATE::text as hoy');
      fecha = dbDateResult.rows[0].hoy;
    }

    // 2. Buscar el control de esa fecha
    let control = await pool.query<ControlCaloricoRow>(
      `SELECT * FROM control_calorico WHERE id_perfil = $1 AND fecha = $2`,
      [perfilId, fecha]
    ).then(res => res.rows[0] ?? null);

    // 3. Si no existe, intentar crearlo desde el plan activo para esa fecha
    if (!control) {
      const planData = await pool.query<{
        id_dia_plan:              number;
        calorias_diarias_calculadas: number;
      }>(
        `SELECT dp.id_dia_plan,
                ec.calorias_diarias_calculadas
         FROM   planes_nutricionales  pn
         JOIN   planes_semanales      ps ON ps.id_plan     = pn.id_plan
         JOIN   dias_plan             dp ON dp.id_semana   = ps.id_semana
         JOIN   evaluaciones_clinicas ec ON ec.id_evaluacion = pn.id_evaluacion
         WHERE  pn.id_perfil        = $1
           AND  pn.estado           = 'activo'
           AND  pn.modulo_habilitado = TRUE
           AND  dp.fecha            = $2`,
        [perfilId, fecha],
      );

      if (planData.rows[0]) {
        control = await calorieControlRepository.findOrCreateByDate(
          perfilId,
          planData.rows[0].id_dia_plan,
          planData.rows[0].calorias_diarias_calculadas ?? 2000,
          fecha
        );
      }
    }

    // 4. Obtener las comidas del plan de esa fecha
    const meals = await mealTrackingRepository.findMealsByPerfilAndDate(perfilId, fecha);

    // 5. Obtener los consumos adicionales de esa fecha
    const additionalIntakesResult = await additionalIntakeRepository.findByPerfil(perfilId, {
      desde: fecha,
      hasta: fecha,
      limit: 100,
      offset: 0
    });
    const additionalIntakes = additionalIntakesResult.rows;

    // 6. Generar balances y estados
    const progresoPct = control
      ? Math.round((control.calorias_totales_consumidas / control.calorias_objetivo) * 100)
      : 0;

    const estado = control
      ? (control.calorias_restantes > 0 ? 'deficit' : control.calorias_restantes === 0 ? 'exacto' : 'exceso')
      : 'deficit';

    let ejerciciosCompensatorios = null;
    if (control && control.calorias_restantes < 0) {
      const caloriasExceso = Math.abs(control.calorias_restantes);
      ejerciciosCompensatorios = await this.getSuggestedExercises(caloriasExceso);
    }

    return {
      tiene_plan_activo: control !== null,
      fecha,
      balance: control
        ? {
            calorias_objetivo:            control.calorias_objetivo,
            calorias_consumidas_plan:     control.calorias_consumidas_plan,
            calorias_consumidas_adicional: control.calorias_consumidas_adicional,
            calorias_totales_consumidas:  control.calorias_totales_consumidas,
            calorias_restantes:           control.calorias_restantes,
            progreso_pct:                 Math.min(progresoPct, 100),
            estado,
          }
        : null,
      ejercicios_compensatorios: ejerciciosCompensatorios,
      meals: meals.map(m => ({
        id_menu_diario: m.id_menu_diario,
        nombre_tiempo: m.nombre_tiempo,
        nombre_plato: m.nombre_plato,
        calorias_aportadas: m.calorias_aportadas,
        realizado: m.realizado ?? false,
        hora_registro: m.hora_registro,
      })),
      additionalIntakes: additionalIntakes.map(ai => ({
        id_consumo_adicional: ai.id_consumo_adicional,
        descripcion_alimento: ai.descripcion_alimento,
        imagen_url: ai.imagen_url,
        calorias_estimadas: ai.calorias_estimadas,
        confirmado: ai.confirmado,
        porcion_g: ai.porcion_g,
        proteinas_g: ai.proteinas_g,
        carbohidratos_g: ai.carbohidratos_g,
        grasas_g: ai.grasas_g,
        mensaje: ai.mensaje,
        alimentos_detectados: ai.alimentos_detectados,
        hora: ai.hora,
      })),
    };
  },

  /**
   * Obtiene el balance calórico del día actual del paciente.
   * Si no existe aún, lo crea con las calorías objetivo de su última evaluación.
   */
  async getTodayBalance(perfilId: number) {

    // Buscar el control de hoy
    let control = await calorieControlRepository.findToday(perfilId);

    // Si no existe, intentar crearlo desde el plan activo
    if (!control) {
      const planData = await pool.query<{
        id_dia_plan:              number;
        calorias_diarias_calculadas: number;
      }>(
        `SELECT dp.id_dia_plan,
                ec.calorias_diarias_calculadas
         FROM   planes_nutricionales  pn
         JOIN   planes_semanales      ps ON ps.id_plan     = pn.id_plan
         JOIN   dias_plan             dp ON dp.id_semana   = ps.id_semana
         JOIN   evaluaciones_clinicas ec ON ec.id_evaluacion = pn.id_evaluacion
         WHERE  pn.id_perfil        = $1
           AND  pn.estado           = 'activo'
           AND  pn.modulo_habilitado = TRUE
           AND  dp.fecha            = CURRENT_DATE`,
        [perfilId],
      );

      if (!planData.rows[0]) {
        return {
          tiene_plan_activo: false,
          mensaje: 'No tienes un plan activo con menús para hoy.',
          balance: null,
        };
      }

      control = await calorieControlRepository.findOrCreateToday(
        perfilId,
        planData.rows[0].id_dia_plan,
        planData.rows[0].calorias_diarias_calculadas ?? 2000,
      );
    }

    // Calcular porcentaje de progreso
    const progresoPct = Math.round(
      (control.calorias_totales_consumidas / control.calorias_objetivo) * 100
    );

    // Determinar estado del balance
    const estado =
      control.calorias_restantes > 0  ? 'deficit'  :
      control.calorias_restantes === 0 ? 'exacto'   : 'exceso';

    // Si hay exceso, sugerir ejercicios compensatorios (RN-05)
    let ejerciciosCompensatorios = null;
    if (control.calorias_restantes < 0) {
      const caloriasExceso = Math.abs(control.calorias_restantes);
      ejerciciosCompensatorios = await this.getSuggestedExercises(caloriasExceso);
    }

    return {
      tiene_plan_activo: true,
      fecha:             control.fecha,
      balance: {
        calorias_objetivo:            control.calorias_objetivo,
        calorias_consumidas_plan:     control.calorias_consumidas_plan,
        calorias_consumidas_adicional: control.calorias_consumidas_adicional,
        calorias_totales_consumidas:  control.calorias_totales_consumidas,
        calorias_restantes:           control.calorias_restantes,
        progreso_pct:                 Math.min(progresoPct, 100),
        estado,
      },
      ejercicios_compensatorios: ejerciciosCompensatorios,
    };
  },


  /**
   * Historial de control calórico para el paciente o la nutricionista.
   */
  async getHistory(
    perfilId: number,
    desde?:   string,
    hasta?:   string,
    page:     number = 1,
    limit:    number = 30,
  ) {
    const offset = (page - 1) * limit;
    const { rows, total } = await calorieControlRepository.findHistory(
      perfilId, desde, hasta, limit, offset
    );

    return {
      data: rows.map(r => ({
        ...r,
        estado:
          r.calorias_restantes > 0  ? 'deficit' :
          r.calorias_restantes === 0 ? 'exacto'  : 'exceso',
      })),
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  },


  /**
   * RN-05: Sugiere ejercicios compensatorios cuando hay exceso calórico.
   * Busca ejercicios que en su duración quemen aproximadamente las calorías en exceso.
   */
  async getSuggestedExercises(caloriasExceso: number) {
    // Estimación simple: 1 min de ejercicio bajo = ~5 kcal, medio = ~8 kcal, alto = ~12 kcal
    const minutosNecesarios = Math.ceil(caloriasExceso / 7); // promedio ~7 kcal/min

    const result = await pool.query<{
      id_ejercicio:  number;
      nombre:        string;
      duracion_min:  number;
      intensidad:    string;
      calorias_aprox: number;
    }>(
      `SELECT id_ejercicio, nombre, duracion_min, intensidad,
              CASE intensidad
                WHEN 'baja'  THEN duracion_min * 5
                WHEN 'media' THEN duracion_min * 8
                WHEN 'alta'  THEN duracion_min * 12
              END AS calorias_aprox
       FROM   ejercicios
       WHERE  activo = TRUE
         AND  duracion_min >= $1
       ORDER  BY ABS(duracion_min - $1) ASC
       LIMIT  3`,
      [Math.min(minutosNecesarios, 60)],
    );

    return {
      calorias_exceso:    caloriasExceso,
      minutos_sugeridos:  minutosNecesarios,
      ejercicios:         result.rows,
    };
  },


  /**
   * Obtiene el progreso semanal del paciente (para dashboard).
   */
  async getWeeklyProgress(perfilId: number) {
    const result = await pool.query<{
      fecha:                        string;
      calorias_objetivo:            number;
      calorias_totales_consumidas:  number;
      calorias_restantes:           number;
    }>(
      `SELECT fecha, calorias_objetivo,
              calorias_totales_consumidas, calorias_restantes
       FROM   control_calorico
       WHERE  id_perfil = $1
         AND  fecha >= CURRENT_DATE - INTERVAL '7 days'
       ORDER  BY fecha ASC`,
      [perfilId],
    );

    return {
      dias_registrados: result.rows.length,
      serie: result.rows.map(r => ({
        fecha:                r.fecha,
        objetivo:             r.calorias_objetivo,
        consumidas:           r.calorias_totales_consumidas,
        restantes:            r.calorias_restantes,
        estado:               r.calorias_restantes >= 0 ? 'deficit' : 'exceso',
      })),
    };
  },

};