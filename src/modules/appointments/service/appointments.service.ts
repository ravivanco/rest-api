import { appointmentsRepository }        from '../repository/appointments.repository';
import { clinicalEvaluationsRepository } from '../../clinical-evaluations/repository/clinical-evaluations.repository';
import { pool }                          from '@database/pool';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  ChangeStatusDto,
  LinkEvaluationDto,
} from '../dto/appointments.dto';
import {
  NotFoundError,
  BusinessRuleError,
  ForbiddenError,
} from '@errors/AppError';

/**
 * Verifica si una fecha y hora cae dentro del horario de atención
 * de la nutricionista.
 *
 * @param horario - horario_atencion de perfiles_nutricionista
 * @param fechaHora - string ISO 8601 de la cita
 * @returns true si está dentro del horario, false si no
 */
const estaEnHorario = (
  horario: Record<string, { inicio: string; fin: string }> | null,
  fechaHora: string,
): boolean => {
  // Si no hay horario configurado, permitir cualquier hora
  if (!horario) return true;

  const fecha = new Date(fechaHora);

  // Obtener el día de la semana en español
  const diasSemana = [
    'domingo', 'lunes', 'martes', 'miercoles',
    'jueves', 'viernes', 'sabado',
  ];
  const diaSemana = diasSemana[fecha.getDay()];

  // Si el día no está en el horario, no hay atención ese día
  const horarioDia = horario[diaSemana];
  if (!horarioDia) return false;

  // Comparar la hora de la cita con el rango de atención
  const horaCita = fecha.toTimeString().slice(0, 5); // "HH:MM"
  return horaCita >= horarioDia.inicio && horaCita <= horarioDia.fin;
};

/**
 * Transiciones de estado válidas.
 * Define qué estados puede tener una cita y desde cuál estado puede moverse.
 */
const TRANSICIONES_VALIDAS: Record<string, string[]> = {
  programada:   ['atendida', 'cancelada', 'reprogramada'],
  reprogramada: ['programada', 'cancelada', 'atendida'],
  atendida:     [],  // estado final
  cancelada:    [],  // estado final
};

export const appointmentsService = {

  /**
   * Crea una nueva cita.
   * Verifica que no exista conflicto de horario con otra cita programada
   * en un rango de ±30 minutos.
   */
  async createAppointment(nutricionistaId: number, data: CreateAppointmentDto) {

    // Verificar conflicto de horario con otras citas
    const hayConflicto = await appointmentsRepository.existsConflict(
      nutricionistaId,
      data.fecha_hora,
    );

    if (hayConflicto) {
      throw new BusinessRuleError(
        'Ya existe una cita en ese horario o muy cercana (±30 minutos).'
      );
    }

    // ── NUEVO: Verificar horario de atención ──────────────────
    const horario = await pool.query<{ horario_atencion: Record<string, { inicio: string; fin: string }> }>(
      `SELECT horario_atencion FROM perfiles_nutricionista WHERE id_usuario = $1`,
      [nutricionistaId],
    );

    const horarioAtencion = horario.rows[0]?.horario_atencion ?? null;

    if (!estaEnHorario(horarioAtencion, data.fecha_hora)) {
      throw new BusinessRuleError(
        'La hora de la cita está fuera del horario de atención configurado. ' +
        'Verifica los días y horarios disponibles.'
      );
    }
    // ─────────────────────────────────────────────────────────

    const cita = await appointmentsRepository.create({
      id_perfil:        data.id_perfil,
      id_nutricionista: nutricionistaId,
      fecha_hora:       data.fecha_hora,
      notas:            data.notas,
    });

    return cita;
  },


  /**
   * Lista las citas de la nutricionista con filtros.
   */
  async listAppointments(
    nutricionistaId: number,
    filters: {
      id_perfil?: number;
      estado?:    string;
      desde?:     string;
      hasta?:     string;
      page:       number;
      limit:      number;
    },
  ) {
    const offset = (filters.page - 1) * filters.limit;
    const { rows, total } = await appointmentsRepository.findAll({
      id_nutricionista: nutricionistaId,
      ...filters,
      offset,
    });

    return {
      data: rows,
      meta: {
        page:        filters.page,
        limit:       filters.limit,
        total,
        total_pages: Math.ceil(total / filters.limit),
      },
    };
  },


  /**
   * Obtiene el detalle de una cita.
   */
  async getById(id: number, nutricionistaId: number) {
    const cita = await appointmentsRepository.findById(id);
    if (!cita) throw new NotFoundError('Cita');

    // Verificar que la cita pertenece a esta nutricionista
    if (cita.id_nutricionista !== nutricionistaId) {
      throw new ForbiddenError('Esta cita no te pertenece');
    }

    return cita;
  },


  /**
   * Actualiza la fecha/hora y/o notas de una cita.
   * Solo se puede editar si está en estado 'programada' o 'reprogramada'.
   */
  async updateAppointment(
    id:              number,
    nutricionistaId: number,
    data:            UpdateAppointmentDto,
  ) {
    const cita = await appointmentsRepository.findById(id);
    if (!cita) throw new NotFoundError('Cita');

    if (cita.id_nutricionista !== nutricionistaId) {
      throw new ForbiddenError('Esta cita no te pertenece');
    }

    if (!['programada', 'reprogramada'].includes(cita.estado)) {
      throw new BusinessRuleError(
        `No se puede editar una cita en estado '${cita.estado}'. ` +
        'Solo se pueden editar citas programadas o reprogramadas.'
      );
    }

    // Verificar conflicto de horario si se cambia la fecha
    if (data.fecha_hora) {
      const hayConflicto = await appointmentsRepository.existsConflict(
        nutricionistaId,
        data.fecha_hora,
        id,
      );

      if (hayConflicto) {
        throw new BusinessRuleError(
          'Ya existe una cita programada en ese horario o muy cercana (±30 minutos).'
        );
      }
    }

    return appointmentsRepository.update(id, data);
  },


  /**
   * Cambia el estado de una cita validando las transiciones permitidas.
   */
  async changeStatus(
    id:              number,
    nutricionistaId: number,
    data:            ChangeStatusDto,
  ) {
    const cita = await appointmentsRepository.findById(id);
    if (!cita) throw new NotFoundError('Cita');

    if (cita.id_nutricionista !== nutricionistaId) {
      throw new ForbiddenError('Esta cita no te pertenece');
    }

    // Verificar que la transición de estado sea válida
    const transicionesPermitidas = TRANSICIONES_VALIDAS[cita.estado] ?? [];
    if (!transicionesPermitidas.includes(data.estado)) {
      throw new BusinessRuleError(
        `No se puede cambiar el estado de '${cita.estado}' a '${data.estado}'. ` +
        `Transiciones válidas desde '${cita.estado}': ${transicionesPermitidas.join(', ') || 'ninguna (estado final)'}.`
      );
    }

    return appointmentsRepository.changeStatus(id, data.estado, data.notas);
  },


  /**
   * Vincula una evaluación clínica a una cita.
   * La evaluación debe pertenecer al mismo paciente que la cita.
   */
  async linkEvaluation(
    id:              number,
    nutricionistaId: number,
    data:            LinkEvaluationDto,
  ) {
    const cita = await appointmentsRepository.findById(id);
    if (!cita) throw new NotFoundError('Cita');

    if (cita.id_nutricionista !== nutricionistaId) {
      throw new ForbiddenError('Esta cita no te pertenece');
    }

    // Verificar que la evaluación existe y pertenece al mismo paciente
    const evaluacion = await clinicalEvaluationsRepository.findById(data.id_evaluacion);
    if (!evaluacion) throw new NotFoundError('Evaluación clínica');

    if (evaluacion.id_perfil !== cita.id_perfil) {
      throw new BusinessRuleError(
        'La evaluación clínica no pertenece al mismo paciente que la cita.'
      );
    }

    return appointmentsRepository.linkEvaluation(id, data.id_evaluacion);
  },


  /**
   * Elimina una cita.
   * Solo se puede eliminar si está en estado 'programada'.
   */
  async deleteAppointment(id: number, nutricionistaId: number) {
    const cita = await appointmentsRepository.findById(id);
    if (!cita) throw new NotFoundError('Cita');

    if (cita.id_nutricionista !== nutricionistaId) {
      throw new ForbiddenError('Esta cita no te pertenece');
    }

    if (cita.estado !== 'programada') {
      throw new BusinessRuleError(
        `No se puede eliminar una cita en estado '${cita.estado}'. ` +
        'Solo se pueden eliminar citas en estado programada. ' +
        'Puedes cancelarla en su lugar.'
      );
    }

    await appointmentsRepository.delete(id);
  },


  /**
   * Lista las citas del paciente autenticado desde la app móvil.
   */
  async getMyAppointments(perfilId: number, soloProximas: boolean = false) {
    return appointmentsRepository.findByPerfil(perfilId, soloProximas);
  },


  /**
   * Obtiene el historial de cumplimiento de citas de un paciente.
   * Muestra el porcentaje de asistencia y el desglose por estado.
   */
  async getComplianceHistory(perfilId: number) {
    const [stats, citas] = await Promise.all([
      appointmentsRepository.getComplianceStats(perfilId),
      appointmentsRepository.findByPerfil(perfilId),
    ]);

    // Clasificar el historial de cumplimiento
    const clasificacion =
      stats.pct_asistencia >= 80 ? 'bueno'   :
      stats.pct_asistencia >= 50 ? 'regular' : 'bajo';

    return {
      estadisticas: {
        ...stats,
        clasificacion,
        mensaje:
          clasificacion === 'bueno'
            ? 'El paciente tiene un excelente historial de asistencia a las citas.'
            : clasificacion === 'regular'
            ? 'El paciente asiste de forma irregular. Considera reforzar el seguimiento.'
            : 'El paciente tiene baja asistencia. Revisar compromisos.',
      },
      historial: citas,
    };
  },

};