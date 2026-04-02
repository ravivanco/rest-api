import { nutritionPlansRepository } from '../repository/nutrition-plans.repository';
import { patientProfileRepository } from '../../patient-profile/repository/patient-profile.repository';
import { clinicalEvaluationsRepository } from '../../clinical-evaluations/repository/clinical-evaluations.repository';
import {
  CreatePlanDto,
  ActivatePlanDto,
  CreateWeekDto,
  CreateMenuDto,
  CreateDailyExerciseDto,
} from '../dto/nutrition-plans.dto';
import {
  NotFoundError,
  BusinessRuleError,
  ForbiddenError,
} from '@errors/AppError';

/** Días válidos para los planes (lunes a viernes principalmente) */
const DIAS_VALIDOS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];

export const nutritionPlansService = {

  /**
   * Crea un nuevo plan nutricional para un paciente.
   * El plan inicia en estado 'pendiente' y modulo_habilitado = false.
   * Se vincula a una evaluación clínica existente.
   */
  async createPlan(
    nutricionistaId: number,
    perfilId:        number,
    data:            CreatePlanDto,
  ) {
    // Verificar que el perfil del paciente existe
    const perfil = await patientProfileRepository.findByPerfilId(perfilId);
    if (!perfil) throw new NotFoundError('Perfil del paciente');

    // Verificar que la evaluación existe y pertenece al paciente
    const evaluacion = await clinicalEvaluationsRepository.findById(data.id_evaluacion);
    if (!evaluacion) throw new NotFoundError('Evaluación clínica');

    if (evaluacion.id_perfil !== perfilId) {
      throw new BusinessRuleError(
        'La evaluación clínica no corresponde a este paciente'
      );
    }

    // Crear el plan
    const plan = await nutritionPlansRepository.create({
      id_perfil:        perfilId,
      id_evaluacion:    data.id_evaluacion,
      id_nutricionista: nutricionistaId,
      notas:            data.notas,
    });

    return plan;
  },


  /**
   * Obtiene todos los planes de un paciente.
   */
  async getPatientPlans(perfilId: number) {
    const perfil = await patientProfileRepository.findByPerfilId(perfilId);
    if (!perfil) throw new NotFoundError('Paciente');

    return nutritionPlansRepository.findByPatient(perfilId);
  },


  /**
   * Obtiene el detalle de un plan.
   */
  async getPlanById(planId: number) {
    const plan = await nutritionPlansRepository.findById(planId);
    if (!plan) throw new NotFoundError('Plan nutricional');
    return plan;
  },


  /**
   * Activa un plan.
   * Regla RN-07: Solo puede activarse si está en estado 'pendiente'.
   * Al activar: estado → activo, modulo_habilitado → true.
   */
  async activatePlan(planId: number, data: ActivatePlanDto) {
    const plan = await nutritionPlansRepository.findById(planId);
    if (!plan) throw new NotFoundError('Plan nutricional');

    if (plan.estado !== 'pendiente') {
      throw new BusinessRuleError(
        `No se puede activar un plan en estado '${plan.estado}'. Solo los planes pendientes pueden activarse.`
      );
    }

    // Verificar que la fecha de fin sea posterior a la de inicio (si se envía)
    if (data.fecha_fin && data.fecha_fin < data.fecha_inicio) {
      throw new BusinessRuleError(
        'La fecha de fin no puede ser anterior a la fecha de inicio'
      );
    }

    return nutritionPlansRepository.activate(planId, data.fecha_inicio, data.fecha_fin ?? null);
  },


  /**
   * Suspende un plan activo.
   * Regla RN-07: Solo puede suspenderse si está 'activo'.
   */
  async suspendPlan(planId: number) {
    const plan = await nutritionPlansRepository.findById(planId);
    if (!plan) throw new NotFoundError('Plan nutricional');

    if (plan.estado !== 'activo') {
      throw new BusinessRuleError(
        `No se puede suspender un plan en estado '${plan.estado}'. Solo los planes activos pueden suspenderse.`
      );
    }

    return nutritionPlansRepository.suspend(planId);
  },


  /**
   * Reactiva un plan suspendido.
   * Regla RN-07: Solo puede reactivarse si está 'suspendido'.
   */
  async reactivatePlan(planId: number) {
    const plan = await nutritionPlansRepository.findById(planId);
    if (!plan) throw new NotFoundError('Plan nutricional');

    if (plan.estado !== 'suspendido') {
      throw new BusinessRuleError(
        `No se puede reactivar un plan en estado '${plan.estado}'. Solo los planes suspendidos pueden reactivarse.`
      );
    }

    return nutritionPlansRepository.reactivate(planId);
  },


  /**
   * Bloquea el módulo Mi Plan sin cambiar el estado.
   * El paciente no podrá ver su plan en la app móvil.
   */
  async lockModule(planId: number) {
    const plan = await nutritionPlansRepository.findById(planId);
    if (!plan) throw new NotFoundError('Plan nutricional');

    if (plan.estado === 'finalizado') {
      throw new BusinessRuleError('No se puede bloquear un plan finalizado');
    }

    return nutritionPlansRepository.lockModule(planId);
  },


  /**
   * Desbloquea el módulo Mi Plan.
   */
  async unlockModule(planId: number) {
    const plan = await nutritionPlansRepository.findById(planId);
    if (!plan) throw new NotFoundError('Plan nutricional');

    if (plan.estado !== 'activo') {
      throw new BusinessRuleError(
        'Solo se puede desbloquear el módulo de un plan activo'
      );
    }

    return nutritionPlansRepository.unlockModule(planId);
  },


  /**
   * Obtiene el plan activo completo del paciente para la app móvil.
   * Incluye semanas, días, menús y ejercicios.
   * Solo retorna el plan si está activo y el módulo habilitado.
   */
  async getActivePlan(perfilId: number) {
    const resultado = await nutritionPlansRepository.findActivePlanComplete(perfilId);

    if (!resultado) {
      return {
        tiene_plan_activo: false,
        mensaje: 'No tienes un plan nutricional activo en este momento.',
        plan: null,
      };
    }

    // Calcular semana actual del plan
    const hoy = new Date().toISOString().split('T')[0];
    const semanaActual = resultado.semanas.find(s =>
      s.semana.fecha_inicio_semana <= hoy && s.semana.fecha_fin_semana >= hoy
    );

    // Agregar campo 'es_hoy' a cada día para la app móvil
    const semanasConHoy = resultado.semanas.map(s => ({
      ...s,
      es_semana_actual: s.semana.id_semana === semanaActual?.semana.id_semana,
      dias: s.dias.map(d => ({
        ...d,
        dia: {
          ...d.dia,
          es_hoy:           d.dia.fecha === hoy,
          // RN-03: solo puede registrar cumplimiento en el día correspondiente
          puede_registrar:  d.dia.fecha === hoy,
        },
      })),
    }));

    return {
      tiene_plan_activo:  true,
      plan:               resultado.plan,
      semana_actual:      semanaActual?.semana ?? null,
      semanas:            semanasConHoy,
    };
  },


  /**
   * Crea una semana dentro del plan.
   */
  async createWeek(planId: number, data: CreateWeekDto) {
    const plan = await nutritionPlansRepository.findById(planId);
    if (!plan) throw new NotFoundError('Plan nutricional');

    if (plan.estado === 'finalizado') {
      throw new BusinessRuleError('No se pueden agregar semanas a un plan finalizado');
    }

    // Verificar que la fecha de fin sea posterior a inicio
    if (data.fecha_fin_semana < data.fecha_inicio_semana) {
      throw new BusinessRuleError(
        'La fecha de fin de la semana no puede ser anterior a la fecha de inicio'
      );
    }

    return nutritionPlansRepository.createWeek({
      id_plan:             planId,
      numero:              data.numero,
      fecha_inicio_semana: data.fecha_inicio_semana,
      fecha_fin_semana:    data.fecha_fin_semana,
    });
  },


  /**
   * Lista las semanas de un plan.
   */
  async getWeeksByPlan(planId: number) {
    const plan = await nutritionPlansRepository.findById(planId);
    if (!plan) throw new NotFoundError('Plan nutricional');

    return nutritionPlansRepository.findWeeksByPlan(planId);
  },


  /**
   * Asigna un menú a un día específico de una semana.
   * Si el día no existe, lo crea automáticamente.
   */
  async createMenu(
    weekId:     number,
    diaSemana:  string,
    fecha:      string,
    data:       CreateMenuDto,
  ) {
    // Verificar que la semana existe
    const semana = await nutritionPlansRepository.findWeekById(weekId);
    if (!semana) throw new NotFoundError('Semana del plan');

    // Validar día de la semana
    if (!DIAS_VALIDOS.includes(diaSemana.toLowerCase())) {
      throw new BusinessRuleError(
        `Día inválido: '${diaSemana}'. Valores válidos: ${DIAS_VALIDOS.join(', ')}`
      );
    }

    // Obtener o crear el día del plan
    const dia = await nutritionPlansRepository.findOrCreateDay(
      weekId,
      diaSemana.toLowerCase(),
      fecha,
    );

    // Asignar el menú al día y tiempo de comida
    const menu = await nutritionPlansRepository.createMenu({
      id_dia_plan:        dia.id_dia_plan,
      id_tiempo_comida:   data.id_tiempo_comida,
      id_plato:           data.id_plato,
      calorias_aportadas: data.calorias_aportadas,
    });

    // Retornar el menú con el día creado/encontrado
    return { dia, menu };
  },


  /**
   * Asigna un ejercicio a un día específico de una semana.
   */
  async createDailyExercise(
    weekId:    number,
    diaSemana: string,
    fecha:     string,
    data:      CreateDailyExerciseDto,
  ) {
    const semana = await nutritionPlansRepository.findWeekById(weekId);
    if (!semana) throw new NotFoundError('Semana del plan');

    if (!DIAS_VALIDOS.includes(diaSemana.toLowerCase())) {
      throw new BusinessRuleError(
        `Día inválido: '${diaSemana}'. Valores válidos: ${DIAS_VALIDOS.join(', ')}`
      );
    }

    const dia = await nutritionPlansRepository.findOrCreateDay(
      weekId,
      diaSemana.toLowerCase(),
      fecha,
    );

    const ejercicio = await nutritionPlansRepository.createDailyExercise({
      id_dia_plan:  dia.id_dia_plan,
      id_ejercicio: data.id_ejercicio,
    });

    return { dia, ejercicio };
  },


  /**
   * Elimina un ejercicio de un día del plan.
   */
  async removeDailyExercise(weekId: number, diaSemana: string, ejercicioDiarioId: number) {
    const semana = await nutritionPlansRepository.findWeekById(weekId);
    if (!semana) throw new NotFoundError('Semana del plan');

    const dias = await nutritionPlansRepository.findDaysByWeek(weekId);
    const dia  = dias.find(d => d.dia_semana === diaSemana.toLowerCase());
    if (!dia)  throw new NotFoundError('Día del plan');

    await nutritionPlansRepository.removeDailyExercise(dia.id_dia_plan, ejercicioDiarioId);
  },

};