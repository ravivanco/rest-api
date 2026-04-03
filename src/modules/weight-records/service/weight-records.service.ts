import { weightRecordsRepository } from '../repository/weight-records.repository';
import { ConflictError, NotFoundError } from '@errors/AppError';

export const weightRecordsService = {

  /**
   * Registra el peso del día.
   * Solo un registro por día — si ya existe, lanza error con instrucción clara.
   */
  async createRecord(perfilId: number, pesoKg: number) {
    const yaExiste = await weightRecordsRepository.existsToday(perfilId);

    if (yaExiste) {
      throw new ConflictError(
        'Ya registraste tu peso hoy. Solo puedes registrar un peso por día.'
      );
    }

    const registro  = await weightRecordsRepository.create(perfilId, pesoKg);
    const ayer      = await weightRecordsRepository.findYesterday(perfilId);
    const primero   = await weightRecordsRepository.findFirst(perfilId);

    return {
      ...registro,
      diferencia_vs_ayer:
        ayer
          ? Number((pesoKg - ayer.peso_kg).toFixed(2))
          : null,
      diferencia_vs_inicio:
        primero && primero.id_registro_peso !== registro.id_registro_peso
          ? Number((pesoKg - primero.peso_kg).toFixed(2))
          : null,
      es_primer_registro: !ayer,
    };
  },


  /**
   * Historial de peso paginado.
   */
  async getHistory(
    perfilId: number,
    page:     number = 1,
    limit:    number = 30,
  ) {
    const offset = (page - 1) * limit;
    const { rows, total } = await weightRecordsRepository.findByPerfil(perfilId, limit, offset);

    // Calcular diferencias entre registros consecutivos
    const rowsConDiff = rows.map((r, i) => {
      const siguiente = rows[i + 1]; // array está ordenado DESC, el siguiente es el anterior
      return {
        ...r,
        diferencia_vs_anterior: siguiente
          ? Number((r.peso_kg - siguiente.peso_kg).toFixed(2))
          : null,
      };
    });

    return {
      data: rowsConDiff,
      meta: {
        page, limit, total,
        total_pages: Math.ceil(total / limit),
      },
    };
  },


  /**
   * Datos para gráfico de evolución de peso.
   */
  async getChartData(perfilId: number, period: string = '30d') {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const data = await weightRecordsRepository.findForChart(perfilId, days);

    if (data.length === 0) {
      return {
        total_registros: 0,
        mensaje: 'No hay registros de peso en el período seleccionado',
        serie: [],
      };
    }

    return {
      total_registros: data.length,
      peso_inicial:    data[0].peso_kg,
      peso_actual:     data[data.length - 1].peso_kg,
      variacion_total: Number((data[data.length - 1].peso_kg - data[0].peso_kg).toFixed(2)),
      periodo_dias:    days,
      serie: data.map(r => ({ fecha: r.fecha, peso_kg: r.peso_kg })),
    };
  },

};