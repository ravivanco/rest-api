import { alertsRepository } from '../repository/alerts.repository';
import { pool } from '@database/pool';
import { NotFoundError } from '@errors/AppError';

type AlertSeverity = 'normal' | 'critica';

const round1 = (value: number): number => Number(value.toFixed(1));

const severityFromRange = (
  value: number,
  normalMin: number,
  criticalMin: number,
): AlertSeverity | null => {
  if (value >= criticalMin) return 'critica';
  if (value >= normalMin) return 'normal';
  return null;
};

const getYesterdayDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
};

export const alertsService = {

  /**
   * Lista las alertas abiertas para usuarios con rol nutricionista.
   */
  async getAlerts(
    filters: {
      tipo?:     string;
      severidad?: string;
      revisada?: string;
      page:      number;
      limit:     number;
    },
  ) {
    const offset = (filters.page - 1) * filters.limit;
    const { rows, total, sin_revisar } = await alertsRepository.findAll({ ...filters, offset });

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
  async markReviewed(alertId: number) {
    const alerta = await alertsRepository.findById(alertId);
    if (!alerta) throw new NotFoundError('Alerta');

    return alertsRepository.markReviewed(alertId);
  },


  /**
   * Obtiene las alertas de un paciente específico.
   */
  async getPatientAlerts(perfilId: number) {
    return alertsRepository.findByPerfil(perfilId);
  },


  async evaluateDailyAlerts(fecha: string = getYesterdayDate()): Promise<{
    fecha: string;
    alertas_generadas_o_actualizadas: number;
  }> {
    const [adherencia, inactividad, consumoAdicional, excesoCalorico] = await Promise.all([
      this.evaluateDailyAdherenceAlerts(fecha),
      this.evaluateInactivityAlerts(fecha),
      this.evaluateAdditionalIntakeAlerts(fecha),
      this.evaluateCalorieExcessAlerts(fecha),
    ]);

    return {
      fecha,
      alertas_generadas_o_actualizadas:
        adherencia + inactividad + consumoAdicional + excesoCalorico,
    };
  },


  async evaluateWeightAlert(perfilId: number, pesoActual: number, fecha: string): Promise<void> {
    if (!Number.isFinite(pesoActual) || pesoActual <= 0) return;

    const previousResult = await pool.query<{
      fecha: string;
      peso_kg: number;
      objetivo: string | null;
    }>(
      `SELECT rp.fecha, rp.peso_kg, pp.objetivo
       FROM registros_peso rp
       JOIN perfiles_paciente pp ON pp.id_perfil = rp.id_perfil
       WHERE rp.id_perfil = $1
         AND rp.fecha < $2
       ORDER BY rp.fecha DESC
       LIMIT 1`,
      [perfilId, fecha],
    );

    const previous = previousResult.rows[0];
    if (!previous || !previous.peso_kg || previous.peso_kg <= 0) return;

    const variacionPorcentual = round1(
      (Math.abs(pesoActual - previous.peso_kg) / previous.peso_kg) * 100,
    );
    const severidad = severityFromRange(variacionPorcentual, 1, 2);
    if (!severidad) return;

    const diferenciaKg = Number((pesoActual - previous.peso_kg).toFixed(2));
    const aumento = diferenciaKg > 0;
    const seAlejo = this.weightMovedAwayFromExpectedTrend(previous.objetivo, diferenciaKg);
    const movimiento = aumento ? 'aumentó' : 'disminuyó';
    const tendencia = seAlejo
      ? ' y se alejó de la tendencia esperada'
      : '';

    await alertsRepository.upsertForDate({
      id_perfil: perfilId,
      tipo: 'peso',
      severidad,
      fecha_alerta: fecha,
      mensaje:
        `Variación de peso ${severidad}: el peso ${movimiento} ${Math.abs(diferenciaKg)} kg ` +
        `(${variacionPorcentual}%) respecto al registro anterior${tendencia}.`,
      datos: {
        fecha_registro: fecha,
        fecha_registro_anterior: previous.fecha,
        peso_actual: pesoActual,
        peso_anterior: previous.peso_kg,
        diferencia_kg: diferenciaKg,
        variacion_porcentual: variacionPorcentual,
        aumento,
        se_alejo_tendencia_esperada: seAlejo,
        objetivo: previous.objetivo,
      },
    });
  },


  async evaluateCalorieExcessAlertForPatient(perfilId: number, fecha: string | Date): Promise<void> {
    const contexts = await this.getDailyCalorieContexts(String(fecha), perfilId);
    if (!contexts[0]) return;
    await this.createOrUpdateCalorieExcessAlert(contexts[0]);
  },


  weightMovedAwayFromExpectedTrend(objetivo: string | null, diferenciaKg: number): boolean {
    const normalized = (objetivo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalized.includes('bajar') || normalized.includes('reducir') || normalized.includes('perder')) {
      return diferenciaKg > 0;
    }
    if (normalized.includes('ganar') || normalized.includes('aumentar') || normalized.includes('masa')) {
      return diferenciaKg < 0;
    }
    return false;
  },


  async evaluateDailyAdherenceAlerts(fecha: string): Promise<number> {
    const result = await pool.query<{
      id_perfil: number;
      comidas_planificadas: string;
      comidas_realizadas: string;
      registros_cumplimiento: string;
    }>(
      `SELECT pn.id_perfil,
              COUNT(md.id_menu_diario) AS comidas_planificadas,
              COUNT(sc.id_seguimiento_comida) AS registros_cumplimiento,
              SUM(CASE WHEN sc.realizado = TRUE THEN 1 ELSE 0 END) AS comidas_realizadas
       FROM planes_nutricionales pn
       JOIN planes_semanales ps ON ps.id_plan = pn.id_plan
       JOIN dias_plan dp ON dp.id_semana = ps.id_semana
       JOIN menus_diarios md ON md.id_dia_plan = dp.id_dia_plan
       LEFT JOIN seguimiento_comidas sc
         ON sc.id_menu_diario = md.id_menu_diario
        AND sc.id_perfil = pn.id_perfil
        AND sc.fecha_registro = dp.fecha
       WHERE pn.estado = 'activo'
         AND pn.modulo_habilitado = TRUE
         AND dp.fecha = $1
       GROUP BY pn.id_perfil`,
      [fecha],
    );

    let count = 0;
    for (const row of result.rows) {
      const planned = parseInt(row.comidas_planificadas);
      const tracked = parseInt(row.registros_cumplimiento);
      const done = parseInt(row.comidas_realizadas) || 0;
      if (planned <= 0 || tracked <= 0) continue;

      const adherence = round1((done / planned) * 100);
      const severidad: AlertSeverity | null =
        adherence < 60 ? 'critica' :
        adherence < 80 ? 'normal' :
        null;

      if (!severidad) continue;

      await alertsRepository.upsertForDate({
        id_perfil: row.id_perfil,
        tipo: 'adherencia',
        severidad,
        fecha_alerta: fecha,
        mensaje:
          `Adherencia diaria ${severidad}: ${done} de ${planned} comidas realizadas ` +
          `(${adherence}%).`,
        datos: {
          fecha,
          comidas_realizadas: done,
          comidas_planificadas: planned,
          adherencia_porcentual: adherence,
        },
      });
      count++;
    }
    return count;
  },


  async evaluateInactivityAlerts(fecha: string): Promise<number> {
    const result = await pool.query<{ id_perfil: number }>(
      `SELECT pn.id_perfil
       FROM planes_nutricionales pn
       JOIN planes_semanales ps ON ps.id_plan = pn.id_plan
       JOIN dias_plan dp ON dp.id_semana = ps.id_semana
       JOIN menus_diarios md ON md.id_dia_plan = dp.id_dia_plan
       LEFT JOIN seguimiento_comidas sc
         ON sc.id_menu_diario = md.id_menu_diario
        AND sc.id_perfil = pn.id_perfil
        AND sc.fecha_registro = dp.fecha
       WHERE pn.estado = 'activo'
         AND pn.modulo_habilitado = TRUE
         AND dp.fecha = $1
       GROUP BY pn.id_perfil
       HAVING COUNT(md.id_menu_diario) > 0
          AND COUNT(sc.id_seguimiento_comida) = 0`,
      [fecha],
    );

    let count = 0;
    for (const row of result.rows) {
      const streak = await this.getInactivityStreak(row.id_perfil, fecha);
      if (streak.days <= 0) continue;

      const severidad: AlertSeverity = streak.days >= 2 ? 'critica' : 'normal';
      if (severidad === 'critica') {
        const alreadySent = await alertsRepository.hasCriticalSince(
          row.id_perfil,
          'inactividad',
          streak.startDate,
        );
        if (alreadySent) continue;
      }

      await alertsRepository.upsertForDate({
        id_perfil: row.id_perfil,
        tipo: 'inactividad',
        severidad,
        fecha_alerta: fecha,
        mensaje:
          severidad === 'critica'
            ? `Inactividad crítica: el paciente no registró comidas durante ${streak.days} días consecutivos.`
            : 'Inactividad normal: el paciente no registró comidas durante 1 día completo.',
        datos: {
          fecha,
          dias_consecutivos: streak.days,
          fecha_inicio_inactividad: streak.startDate,
        },
      });
      count++;
    }
    return count;
  },


  async getInactivityStreak(
    perfilId: number,
    fecha: string,
  ): Promise<{ days: number; startDate: string }> {
    const result = await pool.query<{
      fecha: string;
      registros_cumplimiento: string;
    }>(
      `SELECT dp.fecha::date AS fecha,
              COUNT(sc.id_seguimiento_comida) AS registros_cumplimiento
       FROM planes_nutricionales pn
       JOIN planes_semanales ps ON ps.id_plan = pn.id_plan
       JOIN dias_plan dp ON dp.id_semana = ps.id_semana
       JOIN menus_diarios md ON md.id_dia_plan = dp.id_dia_plan
       LEFT JOIN seguimiento_comidas sc
         ON sc.id_menu_diario = md.id_menu_diario
        AND sc.id_perfil = pn.id_perfil
        AND sc.fecha_registro = dp.fecha
       WHERE pn.id_perfil = $1
         AND pn.estado = 'activo'
         AND pn.modulo_habilitado = TRUE
         AND dp.fecha <= $2
       GROUP BY dp.fecha
       HAVING COUNT(md.id_menu_diario) > 0
       ORDER BY dp.fecha DESC`,
      [perfilId, fecha],
    );

    let days = 0;
    let startDate = fecha;
    for (const row of result.rows) {
      if (parseInt(row.registros_cumplimiento) > 0) break;
      days++;
      startDate = String(row.fecha).split('T')[0];
    }
    return { days, startDate };
  },


  async evaluateAdditionalIntakeAlerts(fecha: string): Promise<number> {
    const result = await this.getDailyAdditionalContexts(fecha);
    let count = 0;
    for (const row of result) {
      const severity = severityFromRange(row.porcentaje_adicional, 10.0001, 20.0001);
      if (!severity) continue;

      await alertsRepository.upsertForDate({
        id_perfil: row.id_perfil,
        tipo: 'consumo_adicional',
        severidad: severity,
        fecha_alerta: fecha,
        mensaje:
          `Consumo adicional ${severity}: ${row.calorias_adicionales} kcal adicionales ` +
          `(${row.porcentaje_adicional}% del objetivo diario) en ${row.cantidad_registros} registros.`,
        datos: {
          fecha_consumo: fecha,
          calorias_adicionales: row.calorias_adicionales,
          porcentaje_objetivo: row.porcentaje_adicional,
          cantidad_registros: row.cantidad_registros,
          calorias_objetivo: row.calorias_objetivo,
        },
      });
      count++;
    }
    return count;
  },


  async getDailyAdditionalContexts(fecha: string): Promise<Array<{
    id_perfil: number;
    calorias_objetivo: number;
    calorias_adicionales: number;
    cantidad_registros: number;
    porcentaje_adicional: number;
  }>> {
    const result = await pool.query<{
      id_perfil: number;
      calorias_objetivo: string;
      calorias_adicionales: string;
      cantidad_registros: string;
    }>(
      `SELECT ca.id_perfil,
              COALESCE(cc.calorias_objetivo, ec.calorias_diarias_calculadas, 0) AS calorias_objetivo,
              COALESCE(SUM(ca.calorias_estimadas), 0) AS calorias_adicionales,
              COUNT(*) AS cantidad_registros
       FROM consumos_adicionales ca
       JOIN planes_nutricionales pn
         ON pn.id_perfil = ca.id_perfil
        AND pn.estado = 'activo'
        AND pn.modulo_habilitado = TRUE
       LEFT JOIN control_calorico cc
         ON cc.id_perfil = ca.id_perfil
        AND cc.fecha = ca.fecha
       LEFT JOIN evaluaciones_clinicas ec ON ec.id_evaluacion = pn.id_evaluacion
       WHERE ca.fecha = $1
         AND ca.confirmado = TRUE
         AND ca.calorias_sumadas = TRUE
       GROUP BY ca.id_perfil, COALESCE(cc.calorias_objetivo, ec.calorias_diarias_calculadas, 0)`,
      [fecha],
    );

    return result.rows
      .map(row => {
        const objective = Number(row.calorias_objetivo);
        const additional = Number(row.calorias_adicionales);
        return {
          id_perfil: row.id_perfil,
          calorias_objetivo: objective,
          calorias_adicionales: additional,
          cantidad_registros: parseInt(row.cantidad_registros),
          porcentaje_adicional: objective > 0 ? round1((additional / objective) * 100) : 0,
        };
      })
      .filter(row => row.calorias_objetivo > 0);
  },


  async evaluateCalorieExcessAlerts(fecha: string): Promise<number> {
    const contexts = await this.getDailyCalorieContexts(fecha);
    let count = 0;
    for (const context of contexts) {
      const created = await this.createOrUpdateCalorieExcessAlert(context);
      if (created) count++;
    }
    return count;
  },


  async getDailyCalorieContexts(
    fecha: string,
    perfilId?: number,
  ): Promise<Array<{
    id_perfil: number;
    fecha: string;
    calorias_objetivo: number;
    calorias_consumidas: number;
    diferencia_calorica: number;
    exceso_porcentual: number;
  }>> {
    const params: unknown[] = [fecha];
    const perfilFilter = perfilId ? 'AND pn.id_perfil = $2' : '';
    if (perfilId) params.push(perfilId);

    const result = await pool.query<{
      id_perfil: number;
      calorias_objetivo: string;
      calorias_plan: string;
      calorias_adicionales: string;
    }>(
      `SELECT pn.id_perfil,
              COALESCE(cc.calorias_objetivo, ec.calorias_diarias_calculadas, 0) AS calorias_objetivo,
              COALESCE(SUM(CASE WHEN sc.realizado = TRUE THEN md.calorias_aportadas ELSE 0 END), 0) AS calorias_plan,
              COALESCE(adds.calorias_adicionales, 0) AS calorias_adicionales
       FROM planes_nutricionales pn
       JOIN planes_semanales ps ON ps.id_plan = pn.id_plan
       JOIN dias_plan dp ON dp.id_semana = ps.id_semana
       JOIN menus_diarios md ON md.id_dia_plan = dp.id_dia_plan
       LEFT JOIN seguimiento_comidas sc
         ON sc.id_menu_diario = md.id_menu_diario
        AND sc.id_perfil = pn.id_perfil
        AND sc.fecha_registro = dp.fecha
       LEFT JOIN control_calorico cc
         ON cc.id_perfil = pn.id_perfil
        AND cc.fecha = dp.fecha
       LEFT JOIN evaluaciones_clinicas ec ON ec.id_evaluacion = pn.id_evaluacion
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(ca.calorias_estimadas), 0) AS calorias_adicionales
         FROM consumos_adicionales ca
         WHERE ca.id_perfil = pn.id_perfil
           AND ca.fecha = dp.fecha
           AND ca.confirmado = TRUE
           AND ca.calorias_sumadas = TRUE
       ) adds ON TRUE
       WHERE pn.estado = 'activo'
         AND pn.modulo_habilitado = TRUE
         AND dp.fecha = $1
         ${perfilFilter}
       GROUP BY pn.id_perfil, COALESCE(cc.calorias_objetivo, ec.calorias_diarias_calculadas, 0),
                COALESCE(adds.calorias_adicionales, 0)`,
      params,
    );

    return result.rows
      .map(row => {
        const objective = Number(row.calorias_objetivo);
        const consumed = Number(row.calorias_plan) + Number(row.calorias_adicionales);
        const difference = consumed - objective;
        return {
          id_perfil: row.id_perfil,
          fecha,
          calorias_objetivo: objective,
          calorias_consumidas: consumed,
          diferencia_calorica: difference,
          exceso_porcentual: objective > 0 && difference > 0
            ? round1((difference / objective) * 100)
            : 0,
        };
      })
      .filter(row => row.calorias_objetivo > 0);
  },


  async createOrUpdateCalorieExcessAlert(context: {
    id_perfil: number;
    fecha: string;
    calorias_objetivo: number;
    calorias_consumidas: number;
    diferencia_calorica: number;
    exceso_porcentual: number;
  }): Promise<boolean> {
    const severity = severityFromRange(context.exceso_porcentual, 10.0001, 20.0001);
    if (!severity) return false;

    await alertsRepository.upsertForDate({
      id_perfil: context.id_perfil,
      tipo: 'exceso_calorico',
      severidad: severity,
      fecha_alerta: context.fecha,
      mensaje:
        `Exceso calórico ${severity}: ${context.calorias_consumidas} kcal consumidas ` +
        `frente a ${context.calorias_objetivo} kcal objetivo (${context.exceso_porcentual}% de exceso).`,
      datos: {
        fecha: context.fecha,
        calorias_objetivo: context.calorias_objetivo,
        calorias_consumidas: context.calorias_consumidas,
        diferencia_calorica: context.diferencia_calorica,
        exceso_porcentual: context.exceso_porcentual,
      },
    });

    return true;
  },

};
