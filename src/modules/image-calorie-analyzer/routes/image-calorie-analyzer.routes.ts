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
 *   description: Analiza una imagen de alimento con Google Vision + Gemini y estima calorías
 */

/**
 * @swagger
 * /image-calorie-analyzer/analyze:
 *   post:
 *     summary: Analizar imagen y estimar calorías con IA
 *     description: |
 *       Usa **Google Vision** para detectar etiquetas y texto OCR, y luego
 *       **Gemini 1.5 Flash** para analizar visualmente la imagen y estimar
 *       calorías, macros y alimentos detectados.
 *
 *       El cliente puede enviar `imagen_base64` si la foto se toma desde la app móvil,
 *       o `imagen_url` si ya existe una URL pública (por ejemplo desde Cloudinary).
 *     tags: [Image Calorie Analyzer]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - required: [imagen_base64]
 *               - required: [imagen_url]
 *             properties:
 *               imagen_base64:
 *                 type: string
 *                 description: Base64 de la imagen o data URL desde la app móvil
 *                 example: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/..."
 *               imagen_url:
 *                 type: string
 *                 example: "https://res.cloudinary.com/demo/image/upload/sample.jpg"
 *               descripcion_alimento:
 *                 type: string
 *                 example: "Arroz con pollo y ensalada"
 *     responses:
 *       200:
 *         description: Análisis completado con estimación calórica detallada
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Imagen analizada correctamente"
 *               data:
 *                 calorias_estimadas: 620
 *                 porcion_estimada_g: 450
 *                 confianza_pct: 85
 *                 fuente_estimacion: "ia_vision"
 *                 alimentos_detectados:
 *                   - nombre: "arroz blanco"
 *                     cantidad_g: 200
 *                     calorias: 260
 *                   - nombre: "frijoles rojos"
 *                     cantidad_g: 150
 *                     calorias: 165
 *                   - nombre: "carne molida guisada"
 *                     cantidad_g: 100
 *                     calorias: 195
 *                 macros:
 *                   proteinas_g: 35
 *                   carbohidratos_g: 68
 *                   grasas_g: 12
 *                 etiquetas_detectadas: ["food", "rice", "beans", "dish"]
 *                 texto_detectado: null
 *                 mensaje: "Bandeja típica colombiana con alto contenido de carbohidratos y proteína moderada."
 *       400:
 *         description: Datos de entrada inválidos
 */
imageCalorieAnalyzerRouter.post(
  '/analyze',
  authenticate,
  requireRole('paciente', 'nutricionista'),
  validate(AnalyzeImageSchema),
  imageCalorieAnalyzerController.analyze,
);

/**
 * @swagger
 * /image-calorie-analyzer/health:
 *   get:
 *     summary: Diagnóstico del módulo de análisis de imágenes
 *     description: Verifica si Gemini y Google Vision están configurados correctamente.
 *     tags: [Image Calorie Analyzer]
 *     responses:
 *       200:
 *         description: Estado del módulo
 */
imageCalorieAnalyzerRouter.get('/health', imageCalorieAnalyzerController.health);
