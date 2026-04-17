import { clinicalEvaluationsRepository } from '../repository/clinical-evaluations.repository';
import { patientProfileRepository }      from '../../patient-profile/repository/patient-profile.repository';
import { calcularRequerimientoNutricional } from '@utils/calorie-calculator';
import { CreateEvaluationDto }           from '../dto/clinical-evaluations.dto';
import { NotFoundError, BusinessRuleError } from '@errors/AppError';
import { pool } from '@database/pool';

export const clinicalEvaluationsService = {

  /**
   * Registra una nueva evaluación clínica.
   *
   * Proceso:
   * 1. Verificar que el paciente existe y tiene perfil con datos completos
   * 2. Calcular automáticamente calorías y distribución de macros
   * 3. Guardar la evaluación (PostgreSQL calcula el IMC automáticamente)
   * 4. Devolver la evaluación con la diferencia vs. la anterior
   */
  async createEvaluation(
    nutricionistaId: number,
    data: CreateEvaluationDto,
  ) {
    // 1. Obtener perfil del paciente con sus datos completos
    const perfil = await patientProfileRepository.findByPerfilId(data.id_perfil);
    if (!perfil) {
      throw new NotFoundError('Perfil del paciente');
    }

    // 2. Obtener datos del usuario para el cálculo (edad y sexo)
    const usuarioResult = await pool.query<{
      edad: number;
      sexo: string;
      nivel_actividad_fisica: string;
      objetivo: string | null;
    }>(
      `SELECT u.edad, u.sexo,
              pp.nivel_actividad_fisica, pp.objetivo
       FROM   usuarios          u
       JOIN   perfiles_paciente pp ON pp.id_usuario = u.id_usuario
       WHERE  pp.id_perfil = $1`,
      [data.id_perfil],
    );

    if (!usuarioResult.rows[0]) {
      throw new NotFoundError('Datos del paciente');
    }

    const usuario = usuarioResult.rows[0];

    // Necesita tener objetivo para calcular macros correctamente
    if (!usuario.objetivo) {
      throw new BusinessRuleError(
        'El paciente debe completar su formulario inicial antes de registrar una evaluación'
      );
    }

    // 3. Calcular calorías y distribución de macros con la fórmula TMB
    const calculo = calcularRequerimientoNutricional({
      peso_kg:         data.peso_kg,
      altura_cm:       data.altura_cm,
      edad:            usuario.edad,
      sexo:            usuario.sexo,
      nivel_actividad: usuario.nivel_actividad_fisica,
      objetivo:        usuario.objetivo,
    });

    // 4. Obtener la evaluación anterior para calcular diferencias
    const evaluacionAnterior = await clinicalEvaluationsRepository.findLatestByPatient(
      data.id_perfil
    );

    // 5. Guardar la evaluación
    const evaluacion = await clinicalEvaluationsRepository.create({
      id_perfil:                       data.id_perfil,
      id_nutricionista:                nutricionistaId,
      fecha_evaluacion:                data.fecha_evaluacion ?? new Date().toISOString().split('T')[0],
      peso_kg:                         data.peso_kg,
      altura_cm:                       data.altura_cm,
      porcentaje_grasa:                data.porcentaje_grasa ?? null,
      masa_muscular_kg:                data.masa_muscular_kg ?? null,
      grasa_visceral:                  data.grasa_visceral ?? null,
      agua_corporal_pct:               data.agua_corporal_pct ?? null,
      masa_osea_kg:                    data.masa_osea_kg ?? null,
      tmb_kcal:                        data.tmb_kcal ?? null,
      otros_indicadores:               data.otros_indicadores ?? null,
      calorias_diarias_calculadas:     calculo.calorias_diarias,
      distribucion_carbohidratos_pct:  calculo.distribucion_carbohidratos_pct,
      distribucion_proteinas_pct:      calculo.distribucion_proteinas_pct,
      distribucion_grasas_pct:         calculo.distribucion_grasas_pct,
    });

    // 6. Calcular diferencias vs. evaluación anterior (si existe)
    const diferencias = evaluacionAnterior
      ? {
          peso_kg:          Number((evaluacion.peso_kg - evaluacionAnterior.peso_kg).toFixed(2)),
          imc:              Number((evaluacion.imc - evaluacionAnterior.imc).toFixed(2)),
          porcentaje_grasa: evaluacion.porcentaje_grasa && evaluacionAnterior.porcentaje_grasa
            ? Number((evaluacion.porcentaje_grasa - evaluacionAnterior.porcentaje_grasa).toFixed(2))
            : null,
          masa_muscular_kg: evaluacion.masa_muscular_kg && evaluacionAnterior.masa_muscular_kg
            ? Number((evaluacion.masa_muscular_kg - evaluacionAnterior.masa_muscular_kg).toFixed(2))
            : null,
          grasa_visceral: evaluacion.grasa_visceral && evaluacionAnterior.grasa_visceral
            ? Number((evaluacion.grasa_visceral - evaluacionAnterior.grasa_visceral).toFixed(2))
            : null,
          agua_corporal_pct: evaluacion.agua_corporal_pct && evaluacionAnterior.agua_corporal_pct
            ? Number((evaluacion.agua_corporal_pct - evaluacionAnterior.agua_corporal_pct).toFixed(2))
            : null,
          masa_osea_kg: evaluacion.masa_osea_kg && evaluacionAnterior.masa_osea_kg
            ? Number((evaluacion.masa_osea_kg - evaluacionAnterior.masa_osea_kg).toFixed(2))
            : null,
          tmb_kcal: evaluacion.tmb_kcal && evaluacionAnterior.tmb_kcal
            ? Number((evaluacion.tmb_kcal - evaluacionAnterior.tmb_kcal).toFixed(2))
            : null,
        }
      : null;

    return {
      ...evaluacion,
      diferencias_vs_anterior: diferencias,
      es_primera_evaluacion:   !evaluacionAnterior,
    };
  },


  /**
   * Lista el historial de evaluaciones de un paciente.
   */
  async getPatientHistory(perfilId: number) {
    // Verificar que el perfil existe
    const perfil = await patientProfileRepository.findByPerfilId(perfilId);
    if (!perfil) throw new NotFoundError('Paciente');

    const evaluaciones = await clinicalEvaluationsRepository.findByPatient(perfilId);

    // Calcular diferencias entre evaluaciones consecutivas
    return evaluaciones.map((eval_, index) => {
      const anterior = evaluaciones[index + 1]; // el siguiente en el array (está ordenado DESC)
      const diferencias = anterior
        ? {
            peso_kg: Number((eval_.peso_kg - anterior.peso_kg).toFixed(2)),
            imc:     Number((eval_.imc - anterior.imc).toFixed(2)),
          }
        : null;

      return { ...eval_, diferencias_vs_anterior: diferencias };
    });
  },


  /**
   * Obtiene el detalle de una evaluación específica.
   */
  async getById(id: number) {
    const evaluacion = await clinicalEvaluationsRepository.findById(id);
    if (!evaluacion) throw new NotFoundError('Evaluación clínica');
    return evaluacion;
  },


  /**
   * Compara dos evaluaciones de un mismo paciente.
   * Muestra diferencias absolutas y porcentuales.
   */
  async compareEvaluations(perfilId: number, evaluationIds: number[]) {
    if (evaluationIds.length !== 2) {
      throw new BusinessRuleError('Debes proporcionar exactamente 2 IDs de evaluaciones');
    }

    const evaluaciones = await clinicalEvaluationsRepository.findByIds(evaluationIds);

    if (evaluaciones.length !== 2) {
      throw new NotFoundError('Una o ambas evaluaciones no fueron encontradas');
    }

    // Verificar que ambas pertenecen al mismo paciente
    const [primera, segunda] = evaluaciones;
    if (primera.id_perfil !== perfilId || segunda.id_perfil !== perfilId) {
      throw new BusinessRuleError('Las evaluaciones no pertenecen a este paciente');
    }

    // Calcular diferencias absolutas y porcentuales
    const calcularDiff = (val1: number | null, val2: number | null) => {
      if (val1 === null || val2 === null) return null;
      const absoluta   = Number((val2 - val1).toFixed(2));
      const porcentual = val1 !== 0
        ? Number(((val2 - val1) / val1 * 100).toFixed(1))
        : null;
      return { absoluta, porcentual };
    };

    return {
      evaluacion_inicial: primera,
      evaluacion_final:   segunda,
      diferencias: {
        peso_kg:          calcularDiff(primera.peso_kg, segunda.peso_kg),
        imc:              calcularDiff(primera.imc, segunda.imc),
        porcentaje_grasa: calcularDiff(primera.porcentaje_grasa, segunda.porcentaje_grasa),
        masa_muscular_kg: calcularDiff(primera.masa_muscular_kg, segunda.masa_muscular_kg),
        grasa_visceral:   calcularDiff(primera.grasa_visceral, segunda.grasa_visceral),
        agua_corporal_pct: calcularDiff(primera.agua_corporal_pct, segunda.agua_corporal_pct),
        masa_osea_kg:     calcularDiff(primera.masa_osea_kg, segunda.masa_osea_kg),
        tmb_kcal:         calcularDiff(primera.tmb_kcal, segunda.tmb_kcal),
        calorias:         calcularDiff(
          primera.calorias_diarias_calculadas,
          segunda.calorias_diarias_calculadas,
        ),
      },
      periodo_dias: Math.abs(
        Math.floor(
          (new Date(segunda.fecha_evaluacion).getTime() -
           new Date(primera.fecha_evaluacion).getTime()) /
          (1000 * 60 * 60 * 24)
        )
      ),
    };
  },


  /**
   * Obtiene las tendencias clínicas del paciente para gráficos.
   * Devuelve series temporales de los indicadores principales.
   */
  async getTrends(perfilId: number) {
    const perfil = await patientProfileRepository.findByPerfilId(perfilId);
    if (!perfil) throw new NotFoundError('Paciente');

    const datos = await clinicalEvaluationsRepository.findTrendsByPatient(perfilId);

    if (datos.length === 0) {
      return {
        total_evaluaciones: 0,
        mensaje: 'El paciente aún no tiene evaluaciones registradas',
        series: {
          peso:    [],
          imc:     [],
          grasa:   [],
          musculo: [],
          calorias: [],
        },
      };
    }

    // Preparar series temporales listas para gráficos en la web
    return {
      total_evaluaciones: datos.length,
      primera_evaluacion: datos[0].fecha_evaluacion,
      ultima_evaluacion:  datos[datos.length - 1].fecha_evaluacion,
      resumen: {
        peso_inicial:  datos[0].peso_kg,
        peso_actual:   datos[datos.length - 1].peso_kg,
        variacion_peso: Number(
          (datos[datos.length - 1].peso_kg - datos[0].peso_kg).toFixed(2)
        ),
        imc_inicial:   datos[0].imc,
        imc_actual:    datos[datos.length - 1].imc,
      },
      series: {
        peso: datos.map(d => ({
          fecha: d.fecha_evaluacion,
          valor: d.peso_kg,
        })),
        imc: datos.map(d => ({
          fecha: d.fecha_evaluacion,
          valor: d.imc,
        })),
        grasa: datos
          .filter(d => d.porcentaje_grasa !== null)
          .map(d => ({
            fecha: d.fecha_evaluacion,
            valor: d.porcentaje_grasa,
          })),
        musculo: datos
          .filter(d => d.masa_muscular_kg !== null)
          .map(d => ({
            fecha: d.fecha_evaluacion,
            valor: d.masa_muscular_kg,
          })),
        agua: datos
          .filter(d => d.agua_corporal_pct !== null)
          .map(d => ({
            fecha: d.fecha_evaluacion,
            valor: d.agua_corporal_pct,
          })),
        grasa_v: datos
          .filter(d => d.grasa_visceral !== null)
          .map(d => ({
            fecha: d.fecha_evaluacion,
            valor: d.grasa_visceral,
          })),
        masa_osea: datos
          .filter(d => d.masa_osea_kg !== null)
          .map(d => ({
            fecha: d.fecha_evaluacion,
            valor: d.masa_osea_kg,
          })),
        tmb: datos
          .filter(d => d.tmb_kcal !== null)
          .map(d => ({
            fecha: d.fecha_evaluacion,
            valor: d.tmb_kcal,
          })),
        calorias: datos
          .filter(d => d.calorias_diarias_calculadas !== null)
          .map(d => ({
            fecha: d.fecha_evaluacion,
            valor: d.calorias_diarias_calculadas,
          })),
      },
    };
  },

};