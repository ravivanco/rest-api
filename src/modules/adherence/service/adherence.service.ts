import { adherenceRepository } from '../repository/adherence.repository';

const clasificarNivel = (pctAlimenticio: number, pctEjercicio: number): string => {
  const promedio = (pctAlimenticio + pctEjercicio) / 2;
  if (promedio >= 80) return 'alto';
  if (promedio >= 50) return 'medio';
  return 'bajo';
};

export const adherenceService = {

  /**
   * Calcula y guarda la adherencia semanal actual de un paciente.
   * Las alertas se evalúan al cierre del día desde el módulo de alertas.
   */
  async calculateCurrentWeek(perfilId: number) {
    const semanaActual = await adherenceRepository.getCurrentWeek(perfilId);
    if (!semanaActual) {
      return {
        tiene_semana_activa: false,
        mensaje: 'El paciente no tiene una semana activa en su plan.',
        adherencia: null,
      };
    }

    const [alimenticio, ejercicio] = await Promise.all([
      adherenceRepository.calcularCumplimientoAlimenticio(perfilId, semanaActual.id_semana),
      adherenceRepository.calcularCumplimientoEjercicio(perfilId, semanaActual.id_semana),
    ]);

    const nivel = clasificarNivel(alimenticio.pct, ejercicio.pct);

    const adherencia = await adherenceRepository.upsert({
      id_perfil:                    perfilId,
      id_semana:                    semanaActual.id_semana,
      pct_cumplimiento_alimenticio: alimenticio.pct,
      pct_cumplimiento_ejercicio:   ejercicio.pct,
      nivel,
    });

    return {
      tiene_semana_activa: true,
      semana: {
        numero:              semanaActual.numero,
        fecha_inicio_semana: semanaActual.fecha_inicio_semana,
        fecha_fin_semana:    semanaActual.fecha_fin_semana,
      },
      adherencia: {
        ...adherencia,
        detalle: {
          alimenticio: {
            realizadas: alimenticio.realizadas,
            total:      alimenticio.total,
            pct:        alimenticio.pct,
          },
          ejercicio: {
            completados: ejercicio.completados,
            total:       ejercicio.total,
            pct:         ejercicio.pct,
          },
        },
      },
    };
  },


  async getHistory(perfilId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const { rows, total } = await adherenceRepository.findByPerfil(perfilId, limit, offset);

    return {
      data: rows,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  },

};
