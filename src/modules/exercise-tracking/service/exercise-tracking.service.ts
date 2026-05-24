import { exerciseTrackingRepository } from '../repository/exercise-tracking.repository';
import { TrackExerciseDto }           from '../dto/exercise-tracking.dto';
import { assertIsToday }              from '@utils/date-validator';
import { NotFoundError, ForbiddenError } from '@errors/AppError';
import { pool } from '@database/pool';
import { ensureDailyExercisesExist, limitExercisesTo60Minutes } from '@utils/exercise-limiter';

export const exerciseTrackingService = {

  /**
   * Marca un ejercicio como completado o no completado.
   * Aplica RN-03: solo en el día correspondiente.
   */
  async trackExercise(perfilId: number, data: TrackExerciseDto) {
    let id_ejercicio_diario = data.id_ejercicio_diario;

    if (!id_ejercicio_diario) {
      // Resolve id_ejercicio_diario from id_ejercicio and fecha
      const idEjercicioNum = typeof data.id_ejercicio === 'string'
        ? parseInt(data.id_ejercicio, 10)
        : data.id_ejercicio;

      if (!idEjercicioNum || isNaN(idEjercicioNum)) {
        throw new NotFoundError('ID de ejercicio no válido');
      }

      const checkQuery = await pool.query<{ id_ejercicio_diario: number }>(
        `SELECT ed.id_ejercicio_diario
         FROM   ejercicios_diarios ed
         JOIN   dias_plan          dp ON dp.id_dia_plan = ed.id_dia_plan
         JOIN   planes_semanales   ps ON ps.id_semana   = dp.id_semana
         JOIN   planes_nutricionales pn ON pn.id_plan   = ps.id_plan
         WHERE  pn.id_perfil = $1
           AND  dp.fecha      = $2
           AND  ed.id_ejercicio = $3
           AND  pn.estado     = 'activo'`,
        [perfilId, data.fecha, idEjercicioNum]
      );

      if (checkQuery.rows.length === 0) {
        throw new NotFoundError('No se encontró el ejercicio programado para esta fecha');
      }

      id_ejercicio_diario = checkQuery.rows[0].id_ejercicio_diario;
    }

    // 1. Obtener fecha del ejercicio diario
    const fechaEjercicio = await exerciseTrackingRepository.getExerciseDate(
      id_ejercicio_diario!
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
      [id_ejercicio_diario],
    );

    if (!ejercicioCheck.rows[0] || ejercicioCheck.rows[0].id_perfil !== perfilId) {
      throw new ForbiddenError('Este ejercicio no pertenece a tu plan');
    }

    // 4. Guardar el seguimiento
    const completadoVal = data.completado !== undefined ? data.completado : true;
    const seguimiento = await exerciseTrackingRepository.upsert({
      id_ejercicio_diario: id_ejercicio_diario!,
      id_perfil:           perfilId,
      completado:          completadoVal,
      hora_registro:       data.hora_registro,
    });

    return { success: true, seguimiento };
  },


  /**
   * Obtiene los ejercicios de un día específico con su estado.
   */
  async getTodayExercises(perfilId: number, fecha?: string) {
    const targetDate = fecha || new Date().toISOString().split('T')[0];

    // 1. Obtener el id_dia_plan para esta fecha y paciente
    const diaPlanQuery = await pool.query<{ id_dia_plan: number }>(
      `SELECT dp.id_dia_plan
       FROM   dias_plan             dp
       JOIN   planes_semanales      ps  ON ps.id_semana   = dp.id_semana
       JOIN   planes_nutricionales  pn  ON pn.id_plan     = ps.id_plan
       WHERE  pn.id_perfil        = $1
         AND  pn.estado           = 'activo'
         AND  pn.modulo_habilitado = TRUE
         AND  dp.fecha            = $2`,
      [perfilId, targetDate]
    );

    if (diaPlanQuery.rows[0]) {
      // Auto-generar e insertar si no existen ejercicios programados para este día
      await ensureDailyExercisesExist(perfilId, diaPlanQuery.rows[0].id_dia_plan);
    }

    const ejercicios = await exerciseTrackingRepository.findTodayByPerfil(perfilId, targetDate);

    // 2. Limitar y calcular duración total
    const { limited: limitedEjercicios, totalDuration } = limitExercisesTo60Minutes(ejercicios);

    const mappedExercises = limitedEjercicios.map(e => ({
      id_ejercicio:         e.id_ejercicio,
      id_ejercicio_diario:  e.id_ejercicio_diario,
      nombre:               e.nombre_ejercicio,
      nombre_ejercicio:     e.nombre_ejercicio,
      descripcion:          e.descripcion_ejercicio || '',
      duracion_min:         e.duracion_min,
      series:               '',
      bloques:              '',
      distancia:            '',
      repeticiones:         '',
      intensidad:           e.intensidad,
      status:
        !e.id_seguimiento_ejercicio ? 'pending' :
        e.completado ? 'done' : 'skip',
      estado:
        !e.id_seguimiento_ejercicio ? 'pendiente' :
        e.completado ? 'completado' : 'no_completado',
      hora_registro:        e.hora_registro,
      puede_registrar:      true,
    }));

    if (limitedEjercicios.length === 0) {
      return {
        tiene_ejercicios_hoy: false,
        mensaje: 'No tienes ejercicios programados para este día.',
        ejercicios: [],
        exercises: [],
        resumen: null,
        total_duration_min: 0,
      };
    }

    const completados  = limitedEjercicios.filter(e => e.completado === true).length;
    const pendientes   = limitedEjercicios.filter(e => !e.id_seguimiento_ejercicio).length;

    return {
      tiene_ejercicios_hoy: true,
      fecha:                targetDate,
      ejercicios:           mappedExercises,
      exercises:            mappedExercises,
      total_duration_min:   totalDuration,
      resumen: {
        total:        limitedEjercicios.length,
        completados,
        pendientes,
        pct_cumplimiento: Math.round((completados / limitedEjercicios.length) * 100),
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