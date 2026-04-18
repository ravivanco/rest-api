import { Request, Response, NextFunction } from 'express';
import cloudinary                          from '@config/cloudinary';
import { ok }                              from '@utils/response';
import { BusinessRuleError }               from '@errors/AppError';

/**
 * Interface para archivos de Multer con Cloudinary.
 * Multer-storage-cloudinary agrega 'path' con la URL y 'filename' con el public_id.
 */
interface CloudinaryFile extends Express.Multer.File {
  path:     string; // URL completa de Cloudinary
  filename: string; // public_id en Cloudinary
}

export const uploadController = {

  /**
   * POST /api/upload/food-image
   * Sube imagen de un alimento a Cloudinary.
   * La URL resultante se guarda en alimentos.imagen_url
   */
  async uploadFoodImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BusinessRuleError('No se recibió ningún archivo de imagen');
      }

      const file = req.file as CloudinaryFile;

      ok(res, {
        url:       file.path,
        public_id: file.filename,
        mensaje:   'Imagen de alimento subida correctamente',
      });

    } catch (error) { next(error); }
  },


  /**
   * POST /api/upload/dish-image
   * Sube imagen de un plato/menú.
   */
  async uploadDishImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BusinessRuleError('No se recibió ningún archivo de imagen');
      }

      const file = req.file as CloudinaryFile;

      ok(res, {
        url:       file.path,
        public_id: file.filename,
        mensaje:   'Imagen de plato subida correctamente',
      });

    } catch (error) { next(error); }
  },


  /**
   * POST /api/upload/exercise-image
   * Sube imagen de un ejercicio.
   */
  async uploadExerciseImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BusinessRuleError('No se recibió ningún archivo de imagen');
      }

      const file = req.file as CloudinaryFile;

      ok(res, {
        url:       file.path,
        public_id: file.filename,
        mensaje:   'Imagen de ejercicio subida correctamente',
      });

    } catch (error) { next(error); }
  },


  /**
   * POST /api/upload/intake-image
   * El paciente sube foto de un consumo adicional.
   * Cualquier paciente autenticado puede usar este endpoint.
   */
  async uploadIntakeImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BusinessRuleError('No se recibió ningún archivo de imagen');
      }

      const file = req.file as CloudinaryFile;

      ok(res, {
        url:       file.path,
        public_id: file.filename,
        mensaje:   'Foto del consumo subida correctamente',
      });

    } catch (error) { next(error); }
  },


  /**
   * DELETE /api/upload/image/:publicId
   * Elimina una imagen de Cloudinary usando su public_id.
   * Solo nutricionistas y administradores pueden eliminar.
   */
  async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // El public_id puede tener barras (dkfitt/alimentos/abc123)
      // Viene como parámetro codificado en URL
      const publicId = decodeURIComponent(req.params.publicId as string);

      const result = await cloudinary.uploader.destroy(publicId);

      if (result.result === 'ok') {
        ok(res, { eliminado: true }, 'Imagen eliminada correctamente');
      } else {
        ok(res, { eliminado: false }, 'La imagen no existe o ya fue eliminada');
      }

    } catch (error) { next(error); }
  },

};