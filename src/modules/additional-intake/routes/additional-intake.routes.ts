import { Router }                      from 'express';
import { additionalIntakeController }  from '../controller/additional-intake.controller';
import { authenticate }                from '@middlewares/authenticate';
import { requireRole }                 from '@middlewares/authorize';
import { validate }                    from '@middlewares/validate';
import { CreateAdditionalIntakeDto, ConfirmIntakeDto } from '../dto/additional-intake.dto';

export const additionalIntakeRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Additional Intake
 *   description: Consumos adicionales fuera del plan con estimación calórica
 */

/**
 * @swagger
 * /additional-intake:
 *   post:
 *     summary: Registrar consumo adicional fuera del plan
 *     description: |
 *       El paciente registra un alimento que consumió fuera de su plan nutricional.
 *
 *       **Flujo completo:**
 *       1. Registra aquí la descripción e imagen (opcional)
 *       2. El sistema intenta estimar calorías automáticamente
 *       3. La respuesta muestra el impacto si confirma
 *       4. El paciente decide confirmar o descartar
 *
 *       **Importante:** Las calorías NO se suman al balance hasta confirmar (**RN-04**).
 *
 *       **imagen_url:** La app móvil debe subir la imagen primero a su storage
 *       (Firebase Storage, AWS S3, Cloudinary) y enviar aquí la URL resultante.
 *     tags: [Additional Intake]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [descripcion_alimento]
 *             properties:
 *               descripcion_alimento:
 *                 type: string
 *                 example: "Hamburguesa con papas fritas"
 *               imagen_url:
 *                 type: string
 *                 example: "https://storage.ejemplo.com/foto-hamburguesa.jpg"
 *               calorias_estimadas:
 *                 type: integer
 *                 example: 850
 *                 description: Calorías ingresadas manualmente (opcional si usa estimación)
 *               hora:
 *                 type: string
 *                 example: "15:30"
 *     responses:
 *       201:
 *         description: Consumo registrado con estimación e impacto proyectado
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 consumo:
 *                   id_consumo_adicional: 8
 *                   descripcion_alimento: Hamburguesa con papas fritas
 *                   calorias_estimadas: 650
 *                   confirmado: false
 *                   calorias_sumadas: false
 *                 estimacion:
 *                   calorias_estimadas: 650
 *                   fuente_estimacion: ia_vision
 *                   confianza_pct: 40
 *                   mensaje: "Estimación basada en la descripción. Ajusta si es necesario."
 *                 impacto_si_confirma:
 *                   calorias_actuales: 870
 *                   calorias_si_confirma: 1520
 *                   calorias_restantes_si_confirma: 670
 *                   excede_objetivo: false
 *                 proximos_pasos:
 *                   confirmar: "PATCH /api/additional-intake/8/confirm"
 *                   descartar: "POST /api/additional-intake/8/discard"
 */
additionalIntakeRouter.post(
  '/',
  authenticate,
  requireRole('paciente'),
  validate(CreateAdditionalIntakeDto),
  additionalIntakeController.create,
);

/**
 * @swagger
 * /additional-intake/{id}/confirm:
 *   patch:
 *     summary: Confirmar consumo y sumar calorías al balance
 *     description: |
 *       El paciente confirma que consumió el alimento registrado.
 *
 *       **Regla RN-04:** Solo aquí se suman las calorías al balance calórico del día.
 *       **Regla RN-05:** Si el total supera el objetivo, la respuesta incluye
 *       ejercicios compensatorios sugeridos.
 *
 *       Puedes ajustar las calorías antes de confirmar si la estimación automática
 *       no fue precisa.
 *     tags: [Additional Intake]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: id_consumo_adicional
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             calorias_estimadas: 750
 *     responses:
 *       200:
 *         description: Calorías sumadas al balance. Incluye ejercicios si hay exceso.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 consumo:
 *                   id_consumo_adicional: 8
 *                   confirmado: true
 *                   calorias_estimadas: 750
 *                   calorias_sumadas: true
 *                 control_calorico:
 *                   calorias_objetivo: 2190
 *                   calorias_consumidas_plan: 870
 *                   calorias_consumidas_adicional: 750
 *                   calorias_totales_consumidas: 1620
 *                   calorias_restantes: 570
 *                   en_exceso: false
 *                 ejercicios_compensatorios: null
 *       404:
 *         description: Consumo no encontrado
 *       422:
 *         description: El consumo ya fue confirmado o es de un día anterior
 */
additionalIntakeRouter.patch(
  '/:id/confirm',
  authenticate,
  requireRole('paciente'),
  validate(ConfirmIntakeDto),
  additionalIntakeController.confirm,
);

/**
 * @swagger
 * /additional-intake/{id}/discard:
 *   post:
 *     summary: Descartar consumo adicional
 *     description: |
 *       El paciente descarta el consumo. Las calorías NO se suman al balance.
 *       Útil si registró algo por error.
 *     tags: [Additional Intake]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Consumo descartado sin impacto en el balance
 *       422:
 *         description: El consumo ya fue confirmado y no se puede descartar
 */
additionalIntakeRouter.post(
  '/:id/discard',
  authenticate,
  requireRole('paciente'),
  additionalIntakeController.discard,
);

/**
 * @swagger
 * /additional-intake/me:
 *   get:
 *     summary: Mis consumos adicionales (paciente)
 *     tags: [Additional Intake]
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema: { type: string }
 *         example: "2026-04-01"
 *       - in: query
 *         name: hasta
 *         schema: { type: string }
 *         example: "2026-04-30"
 *       - in: query
 *         name: confirmado
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Lista paginada de consumos adicionales del paciente
 */
additionalIntakeRouter.get(
  '/me',
  authenticate,
  requireRole('paciente'),
  additionalIntakeController.getMyIntakes,
);

/**
 * @swagger
 * /additional-intake/patient/{id}:
 *   get:
 *     summary: Consumos adicionales de un paciente (nutricionista)
 *     description: |
 *       La nutricionista consulta todos los consumos adicionales de un paciente.
 *       Incluye imagen_url para visualizar en la web.
 *       El `id` es el `id_perfil` del paciente.
 *     tags: [Additional Intake]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: id_perfil del paciente
 *       - in: query
 *         name: desde
 *         schema: { type: string }
 *       - in: query
 *         name: hasta
 *         schema: { type: string }
 *       - in: query
 *         name: confirmado
 *         schema: { type: string, enum: [true, false] }
 *     responses:
 *       200:
 *         description: Consumos adicionales con imágenes y estado de confirmación
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id_consumo_adicional: 8
 *                   fecha: "2026-04-07"
 *                   hora: "15:30:00"
 *                   descripcion_alimento: Hamburguesa con papas fritas
 *                   imagen_url: "https://storage.ejemplo.com/foto.jpg"
 *                   calorias_estimadas: 750
 *                   confirmado: true
 *                   calorias_sumadas: true
 */
additionalIntakeRouter.get(
  '/patient/:id',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  additionalIntakeController.getPatientIntakes,
);

/**
 * @swagger
 * /additional-intake/patient/{id}/impact:
 *   get:
 *     summary: Análisis del impacto calórico de consumos adicionales
 *     description: |
 *       Analiza el patrón de consumo adicional de un paciente en un período.
 *       Útil para que la nutricionista identifique pacientes con alto consumo extra.
 *     tags: [Additional Intake]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: desde
 *         schema: { type: string }
 *         example: "2026-04-01"
 *       - in: query
 *         name: hasta
 *         schema: { type: string }
 *         example: "2026-04-30"
 *     responses:
 *       200:
 *         description: Análisis de impacto calórico del período
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total_consumos: 15
 *                 total_confirmados: 12
 *                 total_descartados: 3
 *                 calorias_totales: 4800
 *                 promedio_por_dia: 320
 *                 clasificacion_impacto: medio
 *                 analisis:
 *                   mensaje: El consumo adicional es moderado. Monitorear tendencia.
 *                   pct_confirmacion: 80
 */
additionalIntakeRouter.get(
  '/patient/:id/impact',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  additionalIntakeController.getImpact,
);