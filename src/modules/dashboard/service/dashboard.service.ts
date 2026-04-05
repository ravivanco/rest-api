import { dashboardRepository } from '../repository/dashboard.repository';
import { adherenceService }    from '../../adherence/service/adherence.service';
import { NotFoundError }       from '@errors/AppError';

export const dashboardService = {

  /**
   * Dashboard principal de la nutricionista.
   * Vista consolidada de todos sus pacientes.
   */
  async getNutritionistDashboard(nutricionistaId: number) {
    const [resumen, distribucionAdherencia] = await Promise.all([
      dashboardRepository.getNutritionistSummary(nutricionistaId),
      dashboardRepository.getAdherenceDistribution(nutricionistaId),
    ]);

    return {
      resumen,
      pacientes_por_adherencia: distribucionAdherencia,
      generado_en: new Date().toISOString(),
    };
  },


  /**
   * Dashboard completo de un paciente para la web.
   */
  async getPatientDashboard(perfilId: number) {
    const dashboard = await dashboardRepository.getPatientDashboard(perfilId);

    if (!dashboard.perfil || Object.keys(dashboard.perfil).length === 0) {
      throw new NotFoundError('Paciente');
    }

    // Calcular adherencia actual en tiempo real
    const adherenciaActual = await adherenceService.calculateCurrentWeek(perfilId);

    return {
      ...dashboard,
      adherencia_semana_actual: adherenciaActual,
      generado_en: new Date().toISOString(),
    };
  },


  /**
   * Progreso del paciente para la app móvil.
   */
  async getPatientProgress(perfilId: number, period: string = '30d') {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const progress = await dashboardRepository.getPatientProgress(perfilId, days);

    // Calcular variación de peso en el período
    const variacionPeso = progress.peso.length >= 2
      ? {
          inicial:  (progress.peso[0] as { peso_kg: number }).peso_kg,
          actual:   (progress.peso[progress.peso.length - 1] as { peso_kg: number }).peso_kg,
          diferencia: Number(
            (
              (progress.peso[progress.peso.length - 1] as { peso_kg: number }).peso_kg -
              (progress.peso[0] as { peso_kg: number }).peso_kg
            ).toFixed(2)
          ),
        }
      : null;

    return {
      periodo_dias: days,
      variacion_peso: variacionPeso,
      ...progress,
      generado_en: new Date().toISOString(),
    };
  },

};