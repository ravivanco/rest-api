import { adherenceRepository } from '../repository/adherence.repository';
import { alertsRepository }    from '../../alerts/repository/alerts.repository';
import { pool }                from '@database/pool';

/** Clasifica el nivel de adherencia según el porcentaje promedio */
const clasificarNivel = (pctAlimenticio: number, pctEjercicio: number): string => {
  const promedio = (pctAlimenticio + pctEjercicio) / 2;
  if (promedio >= 80) return 'alto';
  if (promedio >= 50) return 'medio';
  return 'bajo';
};

export const adherenceService = {

  /**
   * Calcula y guarda la adherencia de la semana actual de un paciente.
   * También genera alertas automáticas si la adherencia es baja.
   */
  async calculateCurrentWeek(perfilId: number) {

    // Verificar que el paciente tiene una semana activa
    const semanaActual = await adherenceRepository.getCurrentWeek(perfilId);
    if (!semanaActual) {
      return {
        tiene_semana_activa: false,
        mensaje: 'El paciente no tiene una semana activa en su plan.',
        adherencia: null,
      };
    }

    // Calcular cumplimientos
    const [alimenticio, ejercicio] = await Promise.all([
      adherenceRepository.calcularCumplimientoAlimenticio(perfilId, semanaActual.id_semana),
      adherenceRepository.calcularCumplimientoEjercicio(perfilId, semanaActual.id_semana),
    ]);

    const nivel = clasificarNivel(alimenticio.pct, ejercicio.pct);

    // Guardar el índice de adherencia
    const adherencia = await adherenceRepository.upsert({
      id_perfil:                    perfilId,
      id_semana:                    semanaActual.id_semana,
      pct_cumplimiento_alimenticio: alimenticio.pct,
      pct_cumplimiento_ejercicio:   ejercicio.pct,
      nivel,
    });

    // Obtener id_nutricionista del plan para generar alertas
    const nutricionistaResult = await pool.query<{ id_nutricionista: number }>(
      `SELECT id_nutricionista FROM planes_nutricionales WHERE id_plan = $1`,
      [semanaActual.id_plan],
    );
    const idNutricionista = nutricionistaResult.rows[0]?.id_nutricionista;

    // Generar alertas automáticas si la adherencia es baja
    if (nivel === 'bajo' && idNutricionista) {
      await this.generateAdherenceAlert(perfilId, idNutricionista, alimenticio.pct, ejercicio.pct);
    }

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


  /**
   * Obtiene el historial de adherencia de un paciente.
   */
  async getHistory(perfilId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const { rows, total } = await adherenceRepository.findByPerfil(perfilId, limit, offset);

    return {
      data: rows,
      meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  },


  /**
   * Genera una alerta de adherencia baja para la nutricionista.
   * Solo crea la alerta si no existe una igual hoy.
   */
  async generateAdherenceAlert(
    perfilId:         number,
    nutricionistaId:  number,
    pctAlimenticio:   number,
    pctEjercicio:     number,
  ): Promise<void> {

    const yaExiste = await alertsRepository.existsToday(perfilId, 'adherencia');
    if (yaExiste) return;

    await alertsRepository.create({
      id_perfil:        perfilId,
      id_nutricionista: nutricionistaId,
      tipo:             'adherencia',
      mensaje:
        `Adherencia baja detectada: alimenticio ${pctAlimenticio}%, ` +
        `ejercicio ${pctEjercicio}%. Considera revisar el plan del paciente.`,
    });
  },


  /**
   * Genera alertas de inactividad para pacientes sin seguimiento en los últimos 3 días.
   * Llamado por el cron job diario.
   */
  async generateInactivityAlerts(): Promise<number> {

    const pacientesInactivos = await pool.query<{
      id_perfil:        number;
      id_nutricionista: number;
      dias_sin_actividad: number;
    }>(
      `SELECT pp.id_perfil, pn.id_nutricionista,
              EXTRACT(DAY FROM NOW() - MAX(COALESCE(sc.created_at, pn.fecha_activacion)))::int
                AS dias_sin_actividad
       FROM   perfiles_paciente    pp
       JOIN   planes_nutricionales pn ON pn.id_perfil = pp.id_perfil
       LEFT JOIN seguimiento_comidas sc ON sc.id_perfil = pp.id_perfil
       WHERE  pn.estado           = 'activo'
         AND  pn.modulo_habilitado = TRUE
       GROUP  BY pp.id_perfil, pn.id_nutricionista, pn.fecha_activacion
       HAVING EXTRACT(DAY FROM NOW() - MAX(COALESCE(sc.created_at, pn.fecha_activacion))) >= 3`,
    );

    let alertasCreadas = 0;

    for (const p of pacientesInactivos.rows) {
      const yaExiste = await alertsRepository.existsToday(p.id_perfil, 'inactividad');
      if (!yaExiste) {
        await alertsRepository.create({
          id_perfil:        p.id_perfil,
          id_nutricionista: p.id_nutricionista,
          tipo:             'inactividad',
          mensaje:          `El paciente lleva ${p.dias_sin_actividad} días sin registrar cumplimiento.`,
        });
        alertasCreadas++;
      }
    }

    return alertasCreadas;
  },


  /**
   * Genera alertas por exceso de consumo adicional.
   * Se activa cuando el consumo adicional supera el 30% del objetivo calórico.
   */
  async generateExcessCalorieAlerts(): Promise<number> {

    const excesos = await pool.query<{
      id_perfil:        number;
      id_nutricionista: number;
      pct_exceso:       number;
    }>(
      `SELECT pp.id_perfil, pn.id_nutricionista,
              ROUND(
                (cc.calorias_consumidas_adicional::numeric / NULLIF(cc.calorias_objetivo, 0)) * 100, 1
              )::int AS pct_exceso
       FROM   control_calorico     cc
       JOIN   perfiles_paciente    pp ON pp.id_perfil = cc.id_perfil
       JOIN   planes_nutricionales pn ON pn.id_perfil = pp.id_perfil
       WHERE  cc.fecha           = CURRENT_DATE
         AND  pn.estado          = 'activo'
         AND  cc.calorias_consumidas_adicional > (cc.calorias_objetivo * 0.30)`,
    );

    let alertasCreadas = 0;

    for (const e of excesos.rows) {
      const yaExiste = await alertsRepository.existsToday(e.id_perfil, 'exceso_calorico');
      if (!yaExiste) {
        await alertsRepository.create({
          id_perfil:        e.id_perfil,
          id_nutricionista: e.id_nutricionista,
          tipo:             'exceso_calorico',
          mensaje:
            `El paciente tiene un consumo adicional del ${e.pct_exceso}% ` +
            `sobre su objetivo calórico hoy.`,
        });
        alertasCreadas++;
      }
    }

    return alertasCreadas;
  },

};