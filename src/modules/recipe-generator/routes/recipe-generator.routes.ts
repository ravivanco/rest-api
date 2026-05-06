import { Router } from 'express';
import { recipeGeneratorController } from '../controller/recipe-generator.controller';
import { authenticate } from '@middlewares/authenticate';
import { validate } from '@middlewares/validate';
import { GenerateGenericSchema, GenerateRecipeSchema } from '../dto/generate-recipe.validator';

export const recipeGeneratorRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Recipe Generator
 *   description: Generacion de recetas con IA
 */

/**
 * @swagger
 * /recipe-generator/generate:
 *   post:
 *     summary: Generar receta personalizada con IA
 *     description: Genera una receta segun el perfil y la evaluacion clinica del paciente.
 *     tags: [Recipe Generator]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_perfil, id_evaluacion, id_tiempo_comida, tiempo_comida_nombre]
 *             properties:
 *               id_perfil:
 *                 type: integer
 *               id_evaluacion:
 *                 type: integer
 *               id_tiempo_comida:
 *                 type: integer
 *               tiempo_comida_nombre:
 *                 type: string
 *                 enum: [desayuno, media_manana, almuerzo, media_tarde, cena]
 *               calorias_objetivo:
 *                 type: integer
 *               id_dia_plan:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Receta generada y guardada
 *       400:
 *         description: Datos invalidos o calorias fuera de rango
 *       404:
 *         description: Perfil o evaluacion no encontrados
 *       502:
 *         description: Error en el servicio de IA
 *       500:
 *         description: Error interno
 */
recipeGeneratorRouter.post(
  '/generate',
  authenticate,
  validate(GenerateRecipeSchema),
  recipeGeneratorController.generate,
);

/**
 * @swagger
 * /recipe-generator/generate-generic:
 *   post:
 *     summary: Generar receta generica con IA
 *     description: Genera una receta sin perfil clinico y la guarda como cache reutilizable.
 *     tags: [Recipe Generator]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_tiempo_comida, tiempo_comida_nombre, calorias_objetivo]
 *             properties:
 *               id_tiempo_comida:
 *                 type: integer
 *               tiempo_comida_nombre:
 *                 type: string
 *                 enum: [desayuno, media_manana, almuerzo, media_tarde, cena]
 *               calorias_objetivo:
 *                 type: integer
 *                 minimum: 100
 *                 maximum: 1500
 *               restricciones:
 *                 type: array
 *                 items:
 *                   type: string
 *               categorias_preferidas:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Receta generica generada y guardada
 *       400:
 *         description: Datos invalidos o calorias fuera de rango
 *       404:
 *         description: Tiempo de comida no encontrado
 *       502:
 *         description: Error en el servicio de IA
 *       500:
 *         description: Error interno
 */
recipeGeneratorRouter.post(
  '/generate-generic',
  authenticate,
  validate(GenerateGenericSchema),
  recipeGeneratorController.generateGeneric,
);

/**
 * @swagger
 * /recipe-generator/generate-week:
 *   post:
 *     summary: Generar plan semanal completo
 *     description: Genera el plan semanal completo para un paciente (5 días × 5 tiempos de comida = 25 recetas máximo).
 *     tags: [Recipe Generator]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_plan, id_semana, id_evaluacion]
 *             properties:
 *               id_plan:
 *                 type: integer
 *                 description: FK a planes_nutricionales
 *               id_semana:
 *                 type: integer
 *                 description: FK a planes_semanales
 *               id_evaluacion:
 *                 type: integer
 *                 description: Evaluación clínica activa del paciente
 *               regenerar:
 *                 type: boolean
 *                 default: false
 *                 description: Si false, respeta recetas ya asignadas. Si true, regenera toda la semana.
 *     responses:
 *       201:
 *         description: Plan semanal generado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_semana:
 *                   type: integer
 *                 semana_numero:
 *                   type: integer
 *                 fecha_inicio:
 *                   type: string
 *                 fecha_fin:
 *                   type: string
 *                 dias:
 *                   type: array
 *                 resumen:
 *                   type: object
 *       400:
 *         description: Body inválido o regenerar mal tipado
 *       404:
 *         description: Plan, semana o evaluación no encontrados
 *       409:
 *         description: Plan no activo o semana incompleta
 *       502:
 *         description: Error de OpenAI
 */
recipeGeneratorRouter.post(
  '/generate-week',
  authenticate,
  recipeGeneratorController.generateWeek,
);
