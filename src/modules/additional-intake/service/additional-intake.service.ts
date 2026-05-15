import { additionalIntakeRepository } from '../repository/additional-intake.repository';
import cloudinary from '@config/cloudinary';
import { calorieControlRepository }   from '../../calorie-control/repository/calorie-control.repository';
import { estimateFromDescription, estimateFromImage } from '../../../infrastructure/calorie-estimator';
import {
  CreateAdditionalIntakeDto,
  ConfirmIntakeDto,
  AnalyzeAdditionalIntakeDto,
} from '../dto/additional-intake.dto';
import { NotFoundError, BusinessRuleError, ForbiddenError } from '@errors/AppError';
import { pool } from '@database/pool';

export const additionalIntakeService = {

  /**
   * Registra un consumo adicional fuera del plan.
   *
   * Flujo:
   * 1. Crear el registro en BD (confirmado = false)
   * 2. Intentar estimar calorías desde la descripción
   * 3. Calcular el impacto si se confirmara (para que el paciente decida)
   * 4. Devolver el registro + estimación + impacto proyectado
   *
   * Las calorías NO se suman al balance hasta que el paciente confirme.
   */
  async registerIntake(perfilId: number, data: CreateAdditionalIntakeDto) {

    // 1. Crear el registro (sin confirmar)
    const consumo = await additionalIntakeRepository.create({
      id_perfil:            perfilId,
      descripcion_alimento: data.descripcion_alimento,
      imagen_url:           data.imagen_url,
      calorias_estimadas:   data.calorias_estimadas,
      hora:                 data.hora,
    });

    // 2. Si no tiene calorías manuales, intentar estimación automática
    let estimacion = null;
    if (!data.calorias_estimadas) {
      // Preferir estimación desde imagen si existe
      if (data.imagen_url) {
        estimacion = await estimateFromImage(data.imagen_url, data.descripcion_alimento);
      }

      // Si no se obtuvo estimación desde imagen, usar descripción
      if (!estimacion || !estimacion.calorias_estimadas) {
        estimacion = await estimateFromDescription(data.descripcion_alimento);
      }

      // Si la estimación encontró calorías, actualizar el registro
      if (estimacion && estimacion.calorias_estimadas) {
        await pool.query(
          `UPDATE consumos_adicionales
           SET calorias_estimadas = $1, updated_at = NOW()
           WHERE id_consumo_adicional = $2`,
          [estimacion.calorias_estimadas, consumo.id_consumo_adicional],
        );
        consumo.calorias_estimadas = estimacion.calorias_estimadas;
      }
    }

    // 3. Calcular impacto proyectado en el balance calórico
    const controlHoy = await calorieControlRepository.findToday(perfilId);
    let impactoSiConfirma = null;

    if (controlHoy && consumo.calorias_estimadas) {
      const nuevoTotal = controlHoy.calorias_totales_consumidas + consumo.calorias_estimadas;
      const nuevasRestantes = controlHoy.calorias_objetivo - nuevoTotal;

      impactoSiConfirma = {
        calorias_actuales:        controlHoy.calorias_totales_consumidas,
        calorias_si_confirma:     nuevoTotal,
        calorias_restantes_actual: controlHoy.calorias_restantes,
        calorias_restantes_si_confirma: nuevasRestantes,
        excede_objetivo:          nuevasRestantes < 0,
        exceso_calorias:          nuevasRestantes < 0 ? Math.abs(nuevasRestantes) : 0,
      };
    }

    return {
      consumo,
      estimacion,
      impacto_si_confirma: impactoSiConfirma,
      proximos_pasos: {
        confirmar:  `PATCH /api/additional-intake/${consumo.id_consumo_adicional}/confirm`,
        descartar:  `POST /api/additional-intake/${consumo.id_consumo_adicional}/discard`,
      },
    };
  },


  /**
   * Analiza un consumo adicional antes de registrarlo.
   * Devuelve contexto para que la app móvil muestre una revisión al usuario.
   */
  async analyzeIntake(
    data: AnalyzeAdditionalIntakeDto,
  ) {

    const descripcion = data.descripcion_alimento ?? '';
    const imageSource = data.imagen_base64
      ? { base64: data.imagen_base64 }
      : data.imagen_url
        ? { url: data.imagen_url }
        : null;

    let estimacion = imageSource
      ? await estimateFromImage(imageSource, descripcion)
      : null;

    if (!estimacion?.calorias_estimadas) {
      estimacion = await estimateFromDescription(descripcion);
    }

    const sugerenciaAccion = estimacion.calorias_estimadas
      ? (estimacion.confianza_pct && estimacion.confianza_pct >= 50 ? 'confirmar' : 'editar')
      : 'ingresar_manualmente';

    return {
      contexto: {
        descripcion_alimento: data.descripcion_alimento ?? null,
        imagen_url: data.imagen_url ?? null,
        calorias_estimadas: estimacion.calorias_estimadas,
        fuente_estimacion: estimacion.fuente_estimacion,
        confianza_pct: estimacion.confianza_pct,
        mensaje: estimacion.mensaje,
        sugerencia_accion: sugerenciaAccion,
      },
      ui_mobile: {
        titulo: estimacion.calorias_estimadas
          ? 'Revisa la estimación antes de guardar'
          : 'No se pudo estimar automáticamente',
        subtitulo: estimacion.calorias_estimadas
          ? 'La app puede mostrar esta estimación para que el usuario la confirme o edite.'
          : 'La app debe solicitar calorías manuales al usuario.',
      },
      proximos_pasos: {
        registrar_consumo: 'POST /api/additional-intake',
        confirmar: 'PATCH /api/additional-intake/{id}/confirm',
        descartar: 'POST /api/additional-intake/{id}/discard',
      },
    };
  },


  /**
   * Confirma un consumo adicional y suma sus calorías al balance.
   *
   * Regla RN-04: Solo al confirmar se suman las calorías.
   * Regla RN-05: Si el total supera el objetivo, se sugieren ejercicios compensatorios.
   */
  async confirmIntake(consumoId: number, perfilId: number, data: ConfirmIntakeDto) {

    // Verificar que el consumo existe y pertenece al paciente
    const consumo = await additionalIntakeRepository.findById(consumoId);
    if (!consumo) throw new NotFoundError('Consumo adicional');
    if (consumo.id_perfil !== perfilId) throw new ForbiddenError('Este consumo no te pertenece');

    // Verificar que no esté ya confirmado
    if (consumo.confirmado) {
      throw new BusinessRuleError(
        'Este consumo ya fue confirmado y sus calorías ya están sumadas al balance del día.'
      );
    }

    // Verificar que sea del día actual (no se puede confirmar consumos de días pasados)
    const hoy = new Date().toISOString().split('T')[0];
    if (consumo.fecha !== hoy) {
      throw new BusinessRuleError(
        `No puedes confirmar consumos de días anteriores. Este consumo es del ${consumo.fecha}.`
      );
    }

    // 1. Confirmar el consumo con las calorías finales
    // Si la imagen existe y está en carpeta temporal, intentamos moverla a la carpeta permanente
    if (consumo.imagen_url) {
      try {
        // Extraer public_id desde la URL de Cloudinary
        const match = consumo.imagen_url.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.(jpg|jpeg|png|webp)$/i);
        if (match && match[1]) {
          const publicId = match[1];
          // Si el publicId contiene '/temp/', lo movemos
          if (publicId.includes('/temp/')) {
            const newPublicId = publicId.replace('/temp/', '/');
            // Renombrar en Cloudinary
            await (cloudinary as any).uploader.rename(publicId, newPublicId, { invalidate: true });
            // Construir nueva URL segura
            const newUrl = (cloudinary as any).url(newPublicId, { secure: true });
            // Actualizar la URL en la BD antes de confirmar
            await pool.query(
              `UPDATE consumos_adicionales SET imagen_url = $1, updated_at = NOW() WHERE id_consumo_adicional = $2`,
              [newUrl, consumoId],
            );
            consumo.imagen_url = newUrl;
          }
        }
      } catch (err) {
        // Loguear pero no bloquear la confirmación
        // eslint-disable-next-line no-console
        console.error('[additional-intake] Error moviendo imagen en Cloudinary:', err);
      }
    }

    const consumoConfirmado = await additionalIntakeRepository.confirm(
      consumoId,
      data.calorias_estimadas,
    );

    // 2. Recalcular calorías adicionales totales del día
    const totalAdicionalHoy = await additionalIntakeRepository.getTodayConfirmedCalories(perfilId);

    // 3. Actualizar el control calórico del día
    let controlActualizado = null;
    const controlHoy = await calorieControlRepository.findToday(perfilId);

    if (controlHoy) {
      controlActualizado = await calorieControlRepository.updateAdditionalCalories(
        perfilId,
        totalAdicionalHoy,
      );

      // Vincular el consumo al control calórico
      await additionalIntakeRepository.linkToControl(consumoId, controlHoy.id_control);
    }

    // 4. RN-05: Si hay exceso calórico, sugerir ejercicios compensatorios
    let ejerciciosCompensatorios = null;
    if (controlActualizado && controlActualizado.calorias_restantes < 0) {
      const exceso = Math.abs(controlActualizado.calorias_restantes);
      const minutosNecesarios = Math.ceil(exceso / 7);

      const ejercicios = await pool.query<{
        id_ejercicio: number;
        nombre:       string;
        duracion_min: number;
        intensidad:   string;
        calorias_aprox: number;
      }>(
        `SELECT id_ejercicio, nombre, duracion_min, intensidad,
                CASE intensidad
                  WHEN 'baja'  THEN duracion_min * 5
                  WHEN 'media' THEN duracion_min * 8
                  WHEN 'alta'  THEN duracion_min * 12
                END AS calorias_aprox
         FROM   ejercicios
         WHERE  activo = TRUE
           AND  duracion_min >= $1
         ORDER  BY ABS(duracion_min - $1) ASC
         LIMIT  3`,
        [Math.min(minutosNecesarios, 60)],
      );

      ejerciciosCompensatorios = {
        exceso_calorico:   exceso,
        minutos_sugeridos: minutosNecesarios,
        ejercicios:        ejercicios.rows,
        mensaje: `Consumiste ${exceso} kcal adicionales sobre tu objetivo. ` +
                 `Considera hacer ejercicio para compensar.`,
      };
    }

    return {
      consumo:                  consumoConfirmado,
      control_calorico:         controlActualizado
        ? {
            calorias_objetivo:            controlActualizado.calorias_objetivo,
            calorias_consumidas_plan:     controlActualizado.calorias_consumidas_plan,
            calorias_consumidas_adicional: controlActualizado.calorias_consumidas_adicional,
            calorias_totales_consumidas:  controlActualizado.calorias_totales_consumidas,
            calorias_restantes:           controlActualizado.calorias_restantes,
            en_exceso:                    controlActualizado.calorias_restantes < 0,
          }
        : null,
      ejercicios_compensatorios: ejerciciosCompensatorios,
    };
  },


  /**
   * Descarta un consumo adicional.
   * Las calorías NO se suman al balance.
   */
  async discardIntake(consumoId: number, perfilId: number) {

    const consumo = await additionalIntakeRepository.findById(consumoId);
    if (!consumo) throw new NotFoundError('Consumo adicional');
    if (consumo.id_perfil !== perfilId) throw new ForbiddenError('Este consumo no te pertenece');

    if (consumo.calorias_sumadas) {
      throw new BusinessRuleError(
        'Este consumo ya fue confirmado y sus calorías están sumadas. No puedes descartarlo.'
      );
    }

    return additionalIntakeRepository.discard(consumoId);
  },


  /**
   * Lista los consumos adicionales del paciente autenticado.
   */
  async getMyIntakes(
    perfilId: number,
    filters: {
      desde?:      string;
      hasta?:      string;
      confirmado?: string;
      page:        number;
      limit:       number;
    },
  ) {
    const offset = (filters.page - 1) * filters.limit;
    const { rows, total } = await additionalIntakeRepository.findByPerfil(
      perfilId, { ...filters, offset }
    );

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
   * Lista los consumos adicionales de un paciente (para la nutricionista).
   */
  async getPatientIntakes(
    perfilId: number,
    filters: {
      desde?:      string;
      hasta?:      string;
      confirmado?: string;
      page:        number;
      limit:       number;
    },
  ) {
    return this.getMyIntakes(perfilId, filters);
  },


  /**
   * Obtiene el impacto calórico de consumos adicionales.
   * La nutricionista usa esto para analizar el comportamiento alimenticio.
   */
  async getImpact(
    perfilId: number,
    desde?:   string,
    hasta?:   string,
  ) {
    const impacto = await additionalIntakeRepository.getImpactByPerfil(
      perfilId, desde, hasta
    );

    // Clasificar el comportamiento
    const clasificacion =
      impacto.promedio_por_dia > 500 ? 'alto'  :
      impacto.promedio_por_dia > 200 ? 'medio' : 'bajo';

    return {
      ...impacto,
      clasificacion_impacto: clasificacion,
      analisis: {
        mensaje:
          clasificacion === 'alto'
            ? 'El paciente tiene un consumo adicional alto. Revisar hábitos alimenticios.'
            : clasificacion === 'medio'
            ? 'El consumo adicional es moderado. Monitorear tendencia.'
            : 'El consumo adicional es bajo. Buen control del plan.',
        pct_confirmacion: impacto.total_consumos > 0
          ? Math.round((impacto.total_confirmados / impacto.total_consumos) * 100)
          : 0,
      },
    };
  },

};