import { alertsRepository } from '../repository/alerts.repository';
import { NotFoundError, ForbiddenError } from '@errors/AppError';

export const alertsService = {

  /**
   * Lista las alertas de la nutricionista autenticada con filtros.
   */
  async getAlerts(
    nutricionistaId: number,
    filters: {
      tipo?:     string;
      revisada?: string;
      page:      number;
      limit:     number;
    },
  ) {
    const offset = (filters.page - 1) * filters.limit;
    const { rows, total, sin_revisar } = await alertsRepository.findByNutricionista(
      nutricionistaId, { ...filters, offset }
    );

    return {
      data: rows,
      meta: {
        page:        filters.page,
        limit:       filters.limit,
        total,
        sin_revisar,
        total_pages: Math.ceil(total / filters.limit),
      },
    };
  },


  /**
   * Marca una alerta como revisada.
   */
  async markReviewed(alertId: number, nutricionistaId: number) {
    const alerta = await alertsRepository.findById(alertId);
    if (!alerta) throw new NotFoundError('Alerta');

    if (alerta.id_nutricionista !== nutricionistaId) {
      throw new ForbiddenError('Esta alerta no te pertenece');
    }

    return alertsRepository.markReviewed(alertId);
  },


  /**
   * Obtiene las alertas de un paciente específico.
   */
  async getPatientAlerts(perfilId: number) {
    return alertsRepository.findByPerfil(perfilId);
  },

};