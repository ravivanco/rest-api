import { patientsRepository } from '../repository/patients.repository';
import { NotFoundError, ForbiddenError } from '@errors/AppError';

export const patientsService = {

  /**
   * Lista pacientes con filtros.
   * Solo la nutricionista puede ver la lista completa.
   */
  async listPatients(filters: {
    search?:               string;
    estado_plan?:          string;
    adherencia?:           string;
    formulario_completado?: string;
    page:                  number;
    limit:                 number;
  }) {
    const offset = (filters.page - 1) * filters.limit;

    const { rows, total } = await patientsRepository.findAll({
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
   * Obtiene la ficha completa de un paciente.
   * La nutricionista puede ver cualquier paciente.
   * El paciente solo puede ver su propio perfil.
   */
  async getPatientById(userId: number) {
    const patient = await patientsRepository.findById(userId);

    if (!patient) {
      throw new NotFoundError('Paciente');
    }

    return patient;
  },


  /**
   * Obtiene el perfil del paciente autenticado (para la app móvil).
   */
  async getMyProfile(perfilId: number) {
    const patient = await patientsRepository.findByPerfilId(perfilId);

    if (!patient) {
      throw new NotFoundError('Perfil del paciente');
    }

    return patient;
  },


  /**
   * Verifica que el paciente tiene acceso a ver/editar su propio perfil.
   * La nutricionista puede ver cualquier perfil.
   */
  verifyAccess(
    requestedUserId: number,
    currentUser: { id: number; role: string; id_perfil: number | null }
  ): void {
    if (currentUser.role === 'nutricionista' || currentUser.role === 'administrador') {
      return; // La nutricionista puede ver cualquier paciente
    }

    // El paciente solo puede ver su propio perfil
    if (currentUser.id !== requestedUserId) {
      throw new ForbiddenError('Solo puedes ver tu propia información');
    }
  },

};