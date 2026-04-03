import { mealTrackingRepository }    from '../repository/meal-tracking.repository';
import { calorieControlRepository }  from '../../calorie-control/repository/calorie-control.repository';
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

      const controlHoy = await calorieControlRepository.findToday(perfilId);
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
    const menus = await mealTrackingRepository.findTodayByPerfil(perfilId);

    if (menus.length === 0) {
      return {
        tiene_menus_hoy: false,
        mensaje: 'No tienes menús programados para hoy.',
        menus: [],
        resumen: null,
      };
    }

    const realizadas   = menus.filter(m => m.realizado === true).length;
    const noRealizadas = menus.filter(m => m.realizado === false && m.id_seguimiento_comida).length;
    const pendientes   = menus.filter(m => !m.id_seguimiento_comida).length;

    return {
      tiene_menus_hoy: true,
      fecha:           new Date().toISOString().split('T')[0],
      menus: menus.map(m => ({
        id_menu_diario:    m.id_menu_diario,
        nombre_tiempo:     m.nombre_tiempo,
        hora_inicio:       m.hora_inicio,
        nombre_plato:      m.nombre_plato,
        calorias_aportadas: m.calorias_aportadas,
        estado:
          !m.id_seguimiento_comida ? 'pendiente' :
          m.realizado ? 'realizado' : 'no_realizado',
        hora_registro: m.hora_registro,
        // RN-03: puede registrar porque ya se validó que la fecha es hoy
        puede_registrar: true,
      })),
      resumen: {
        total:        menus.length,
        realizadas,
        no_realizadas: noRealizadas,
        pendientes,
        pct_cumplimiento: Math.round((realizadas / menus.length) * 100),
      },
    };
  },


  /**
   * Obtiene el historial de seguimiento de comidas para la web.
   */
  async getPatientMealHistory(perfilId: number, fecha: string) {
    return mealTrackingRepository.findByPerfilAndDate(perfilId, fecha);
  },

};