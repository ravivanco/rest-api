import { mealTrackingRepository }    from '../repository/meal-tracking.repository';
import { calorieControlRepository }  from '../../calorie-control/repository/calorie-control.repository';
import { nutritionPlansRepository }  from '../../nutrition-plans/repository/nutrition-plans.repository';
import { TrackMealDto }              from '../dto/meal-tracking.dto';
import { assertIsToday }             from '@utils/date-validator';
import { NotFoundError, ForbiddenError } from '@errors/AppError';
import { pool } from '@database/pool';

export const mealTrackingService = {

  /**
   * Marca una comida como realizada o no realizada.
   *
   * Reglas aplicadas:
   * - RN-03: Solo se puede registrar en el día actual
   * - El menú debe pertenecer al perfil del paciente
   * - Si se marca como realizada, suma calorías al control calórico
   * - Si se desmarca, resta las calorías del control calórico
   */
  async trackMeal(perfilId: number, data: TrackMealDto) {

    // 1. Obtener la fecha del menú para validar RN-03
    const fechaMenu = await mealTrackingRepository.getMenuDate(data.id_menu_diario);

    if (!fechaMenu) {
      throw new NotFoundError('Menú diario');
    }

    // 2. RN-03: Validar que sea el día actual
    assertIsToday(fechaMenu);

    // 3. Verificar que el menú pertenece al paciente
    const menuCheck = await pool.query<{ id_perfil: number }>(
      `SELECT pn.id_perfil
       FROM   menus_diarios        md
       JOIN   dias_plan            dp ON dp.id_dia_plan = md.id_dia_plan
       JOIN   planes_semanales     ps ON ps.id_semana   = dp.id_semana
       JOIN   planes_nutricionales pn ON pn.id_plan     = ps.id_plan
       WHERE  md.id_menu_diario = $1`,
      [data.id_menu_diario],
    );

    if (!menuCheck.rows[0] || menuCheck.rows[0].id_perfil !== perfilId) {
      throw new ForbiddenError('Este menú no pertenece a tu plan');
    }

    // 4. Estado anterior del seguimiento (para saber si ya estaba marcado)
    const anterior = await mealTrackingRepository.findByMenuAndPerfil(
      data.id_menu_diario, perfilId
    );
    const estabaRealizado = anterior?.realizado ?? false;

    // 5. Guardar el seguimiento
    const seguimiento = await mealTrackingRepository.upsert({
      id_menu_diario: data.id_menu_diario,
      id_perfil:      perfilId,
      realizado:      data.realizado,
      hora_registro:  data.hora_registro,
    });

    // 6. Actualizar control calórico solo si el estado cambió
    if (estabaRealizado !== data.realizado) {
      // Recalcular desde cero: suma todas las comidas realizadas hoy
      const totalCaloriasPlan = await mealTrackingRepository.getTodayCaloriesFromPlan(perfilId);

      let controlHoy = await calorieControlRepository.findToday(perfilId);
      if (!controlHoy) {
        // Buscar el id_dia_plan de hoy y calorías objetivo para inicializar el registro
        const planData = await pool.query<{
          id_dia_plan:                 number;
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
        if (planData.rows[0]) {
          controlHoy = await calorieControlRepository.findOrCreateToday(
            perfilId,
            planData.rows[0].id_dia_plan,
            planData.rows[0].calorias_diarias_calculadas ?? 2000,
          );
        }
      }

      if (controlHoy) {
        await calorieControlRepository.updatePlanCalories(perfilId, totalCaloriasPlan);
      }
    }

    // 7. Obtener control calórico actualizado para devolver
    const controlActualizado = await calorieControlRepository.findToday(perfilId);

    return {
      seguimiento,
      control_calorico: controlActualizado
        ? {
            calorias_objetivo:            controlActualizado.calorias_objetivo,
            calorias_consumidas_plan:     controlActualizado.calorias_consumidas_plan,
            calorias_totales_consumidas:  controlActualizado.calorias_totales_consumidas,
            calorias_restantes:           controlActualizado.calorias_restantes,
            en_deficit:                   controlActualizado.calorias_restantes > 0,
            en_exceso:                    controlActualizado.calorias_restantes < 0,
          }
        : null,
    };
  },


  /**
   * Obtiene las comidas del día actual del paciente con su estado de cumplimiento.
   */
  async getTodayMeals(perfilId: number) {
    const activePlan = await nutritionPlansRepository.findActivePlanComplete(perfilId);

    if (!activePlan) {
      return {
        tiene_plan_activo: false,
        mensaje: 'No tienes un plan nutricional activo en este momento.',
        semanas: [],
        dias: [],
      };
    }

    const trackingRows = await pool.query<{
      id_menu_diario: number;
      realizado: boolean;
      hora_registro: string | null;
    }>(
      `SELECT id_menu_diario, realizado, hora_registro FROM seguimiento_comidas WHERE id_perfil = $1`,
      [perfilId],
    );

    const trackingMap = new Map<number, { realizado: boolean; hora_registro: string | null }>();
    for (const row of trackingRows.rows) {
      trackingMap.set(row.id_menu_diario, {
        realizado: row.realizado,
        hora_registro: row.hora_registro,
      });
    }

    const hoy = new Date().toISOString().split('T')[0];

    // Encontrar la semana actual en base al rango de fechas
    const semanaActual = activePlan.semanas.find(s =>
      s.semana.fecha_inicio_semana <= hoy && s.semana.fecha_fin_semana >= hoy
    );

    const semanasEstructuradas = activePlan.semanas.map(s => {
      const esSemanaActual = s.semana.id_semana === (semanaActual?.semana.id_semana ?? activePlan.semanas[0]?.semana.id_semana);
      return {
        id_semana:           s.semana.id_semana,
        id_plan:             s.semana.id_plan,
        numero:              s.semana.numero,
        fecha_inicio_semana: s.semana.fecha_inicio_semana,
        fecha_fin_semana:    s.semana.fecha_fin_semana,
        es_semana_actual:    esSemanaActual,
        dias: s.dias.map(d => ({
          id_dia_plan: d.dia.id_dia_plan,
          id_semana:   d.dia.id_semana,
          dia_semana:  d.dia.dia_semana,
          fecha:       d.dia.fecha,
          es_hoy:      d.dia.fecha === hoy,
          puede_registrar: d.dia.fecha === hoy,
          menus: d.menus.map(m => {
            const track = trackingMap.get(m.id_menu_diario);
            return {
              id_menu_diario:     m.id_menu_diario,
              id_tiempo_comida:   m.id_tiempo_comida,
              tiempo_comida:      m.nombre_tiempo ?? '',
              nombre_tiempo:      m.nombre_tiempo ?? '',
              id_plato:           m.id_plato,
              nombre_plato:       m.nombre_plato ?? '',
              calorias_aportadas: m.calorias_aportadas,
              estado:
                !track ? 'pendiente' :
                track.realizado ? 'realizado' : 'no_realizado',
              hora_registro:      track ? track.hora_registro : null,
            };
          }),
        })),
      };
    });

    // Obtener los días de la semana activa/actual
    const semanaActivaEstructurada = semanasEstructuradas.find(s => s.es_semana_actual) ?? semanasEstructuradas[0];
    const diasActivos = semanaActivaEstructurada ? semanaActivaEstructurada.dias : [];

    return {
      tiene_plan_activo: true,
      plan:              activePlan.plan,
      semana_actual:     semanaActual?.semana ?? activePlan.semanas[0]?.semana ?? null,
      semanas:           semanasEstructuradas,
      dias:              diasActivos, // Para la estructura data -> dias -> menus del móvil
    };
  },


  /**
   * Obtiene el historial de seguimiento de comidas para la web.
   */
  async getPatientMealHistory(perfilId: number, fecha: string) {
    return mealTrackingRepository.findByPerfilAndDate(perfilId, fecha);
  },

};