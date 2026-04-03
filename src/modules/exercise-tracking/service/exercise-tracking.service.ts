import { exerciseTrackingRepository } from '../repository/exercise-tracking.repository';
import { TrackExerciseDto }           from '../dto/exercise-tracking.dto';
import { assertIsToday }              from '@utils/date-validator';
import { NotFoundError, ForbiddenError } from '@errors/AppError';
import { pool } from '@database/pool';

export const exerciseTrackingService = {

  /**
   * Marca un ejercicio como completado o no completado.
   * Aplica RN-03: solo en el día correspondiente.
   */
  async trackExercise(perfilId: number, data: TrackExerciseDto) {

    // 1. Obtener fecha del ejercicio diario
    const fechaEjercicio = await exerciseTrackingRepository.getExerciseDate(
      data.id_ejercicio_diario
    );

    if (!fechaEjercicio) {
      throw new NotFoundError('Ejercicio diario');
    }

    // 2. RN-03: Validar que sea el día actual
    assertIsToday(fechaEjercicio);

    // 3. Verificar que el ejercicio pertenece al paciente
    const ejercicioCheck = await pool.query<{ id_perfil: number }>(
      `SELECT pn.id_perfil
       FROM   ejercicios_diarios   ed
       JOIN   dias_plan            dp ON dp.id_dia_plan = ed.id_dia_plan
       JOIN   planes_semanales     ps ON ps.id_semana   = dp.id_semana
       JOIN   planes_nutricionales pn ON pn.id_plan     = ps.id_plan
       WHERE  ed.id_ejercicio_diario = $1`,
      [data.id_ejercicio_diario],
    );

    if (!ejercicioCheck.rows[0] || ejercicioCheck.rows[0].id_perfil !== perfilId) {
      throw new ForbiddenError('Este ejercicio no pertenece a tu plan');
    }

    // 4. Guardar el seguimiento
    const seguimiento = await exerciseTrackingRepository.upsert({
      id_ejercicio_diario: data.id_ejercicio_diario,
      id_perfil:           perfilId,
      completado:          data.completado,
      hora_registro:       data.hora_registro,
    });

    return { seguimiento };
  },


  /**
   * Obtiene los ejercicios del día actual con su estado.
   */
  async getTodayExercises(perfilId: number) {
    const ejercicios = await exerciseTrackingRepository.findTodayByPerfil(perfilId);

    if (ejercicios.length === 0) {
      return {
        tiene_ejercicios_hoy: false,
        mensaje: 'No tienes ejercicios programados para hoy.',
        ejercicios: [],
        resumen: null,
      };
    }

    const completados  = ejercicios.filter(e => e.completado === true).length;
    const pendientes   = ejercicios.filter(e => !e.id_seguimiento_ejercicio).length;

    return {
      tiene_ejercicios_hoy: true,
      fecha:                new Date().toISOString().split('T')[0],
      ejercicios: ejercicios.map(e => ({
        id_ejercicio_diario:  e.id_ejercicio_diario,
        nombre_ejercicio:     e.nombre_ejercicio,
        duracion_min:         e.duracion_min,
        intensidad:           e.intensidad,
        estado:
          !e.id_seguimiento_ejercicio ? 'pendiente' :
          e.completado ? 'completado' : 'no_completado',
        hora_registro: e.hora_registro,
        puede_registrar: true,
      })),
      resumen: {
        total:        ejercicios.length,
        completados,
        pendientes,
        pct_cumplimiento: Math.round((completados / ejercicios.length) * 100),
      },
    };
  },


  /**
   * Historial de ejercicios de un paciente por fecha (para la web).
   */
  async getPatientExerciseHistory(perfilId: number, fecha: string) {
    return exerciseTrackingRepository.findByPerfilAndDate(perfilId, fecha);
  },

};