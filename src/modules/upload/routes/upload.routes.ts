import { Router }            from 'express';
import { uploadController }  from '../controller/upload.controller';
import { authenticate }      from '@middlewares/authenticate';
import { requireRole }       from '@middlewares/authorize';
import {
  uploadFood,
  uploadDish,
  uploadExercise,
  uploadIntake,
}                            from '@config/multer';

export const uploadRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Upload
 *   description: Subida de imágenes a Cloudinary
 */

/**
 * @swagger
 * /upload/food-image:
 *   post:
 *     summary: Subir imagen de un alimento
 *     description: |
 *       Sube una imagen a Cloudinary en la carpeta dkfitt/alimentos.
 *       Retorna la URL que debes guardar en el campo imagen_url del alimento.
 *
 *       **Cómo usar:**
 *       1. Llama a este endpoint con el archivo como multipart/form-data
 *       2. Copia la URL retornada
 *       3. Úsala en POST /api/foods o PUT /api/foods/:id
 *     tags: [Upload]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: URL de la imagen en Cloudinary
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 url: "https://res.cloudinary.com/ddegmlh4o/image/upload/v1/dkfitt/alimentos/abc123.jpg"
 *                 public_id: "dkfitt/alimentos/abc123"
 */
uploadRouter.post(
  '/food-image',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  uploadFood.single('image'),
  uploadController.uploadFoodImage,
);

/**
 * @swagger
 * /upload/dish-image:
 *   post:
 *     summary: Subir imagen de un plato
 *     tags: [Upload]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: URL de la imagen del plato
 */
uploadRouter.post(
  '/dish-image',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  uploadDish.single('image'),
  uploadController.uploadDishImage,
);

/**
 * @swagger
 * /upload/exercise-image:
 *   post:
 *     summary: Subir imagen de un ejercicio
 *     tags: [Upload]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: URL de la imagen del ejercicio
 */
uploadRouter.post(
  '/exercise-image',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  uploadExercise.single('image'),
  uploadController.uploadExerciseImage,
);

/**
 * @swagger
 * /upload/intake-image:
 *   post:
 *     summary: El paciente sube foto de un consumo adicional
 *     description: |
 *       El paciente sube una foto de lo que comió fuera del plan.
 *       La URL retornada se usa en POST /api/additional-intake como imagen_url.
 *       Además, este endpoint intenta calcular calorías automáticamente con Cloud Vision.
 *
 *       Puedes enviar `descripcion_alimento` como contexto (prompt textual) para mejorar
 *       la estimación cuando la imagen no sea suficientemente clara.
 *     tags: [Upload]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               descripcion_alimento:
 *                 type: string
 *                 example: "Arroz con pollo y ensalada"
 *     responses:
 *       200:
 *         description: URL de la foto del consumo y estimación calórica
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 url: "https://res.cloudinary.com/ddegmlh4o/image/upload/v1/dkfitt/consumo_adicional/abc123.jpg"
 *                 public_id: "dkfitt/consumo_adicional/abc123"
 *                 mensaje: "Foto del consumo subida correctamente"
 *                 estimacion:
 *                   calorias_estimadas: 650
 *                   fuente_estimacion: ia_vision
 *                   confianza_pct: 60
 *                   mensaje: "Estimación basada en etiquetas OCR y descripción. Verifica antes de confirmar."
 */
uploadRouter.post(
  '/intake-image',
  authenticate,
  requireRole('paciente'),
  uploadIntake.single('image'),
  uploadController.uploadIntakeImage,
);

/**
 * @swagger
 * /upload/cloudinary/sign:
 *   post:
 *     summary: Obtener firma para hacer upload firmado a Cloudinary
 *     tags: [Upload]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               folder:
 *                 type: string
 *                 example: "dkfitt/consumo_adicional/temp"
 *     responses:
 *       200:
 *         description: Firma y parámetros para subir a Cloudinary desde el cliente
 */
uploadRouter.post(
  '/cloudinary/sign',
  authenticate,
  requireRole('paciente'),
  uploadController.cloudinarySign,
);

/**
 * @swagger
 * /upload/image/{publicId}:
 *   delete:
 *     summary: Eliminar imagen de Cloudinary
 *     tags: [Upload]
 *     parameters:
 *       - in: path
 *         name: publicId
 *         required: true
 *         schema: { type: string }
 *         description: public_id de la imagen en Cloudinary (codificado en URL)
 *     responses:
 *       200:
 *         description: Imagen eliminada
 */
uploadRouter.delete(
  '/image/:publicId',
  authenticate,
  requireRole('nutricionista', 'administrador'),
  uploadController.deleteImage,
);