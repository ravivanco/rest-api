import { Router } from 'express';
import { authenticate } from '@middlewares/authenticate';
import { requireRole } from '@middlewares/authorize';
import { validate } from '@middlewares/validate';
import { AnalyzeImageSchema } from '../dto/analyze-image.validator';
import { imageCalorieAnalyzerController } from '../controller/image-calorie-analyzer.controller';

export const imageCalorieAnalyzerRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Image Calorie Analyzer
 *   description: Analiza una imagen de alimento y estima calorias
 */

/**
 * @swagger
 * /image-calorie-analyzer/analyze:
 *   post:
 *     summary: Analizar imagen y estimar calorias
 *     tags: [Image Calorie Analyzer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [imagen_url]
 *             properties:
 *               imagen_url:
 *                 type: string
 *                 example: "https://res.cloudinary.com/demo/image/upload/sample.jpg"
 *               descripcion_alimento:
 *                 type: string
 *                 example: "Arroz con pollo y ensalada"
 *     responses:
 *       200:
 *         description: Analisis completado con estimacion calorica
 */
imageCalorieAnalyzerRouter.post(
  '/analyze',
  authenticate,
  requireRole('paciente'),
  validate(AnalyzeImageSchema),
  imageCalorieAnalyzerController.analyze,
);
