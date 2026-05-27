import { Request, Response, NextFunction } from 'express';
import cloudinary                          from '@config/cloudinary';
import { env }                             from '@config/env';
import { ok }                              from '@utils/response';
import { BusinessRuleError }               from '@errors/AppError';
import {
  estimateFromDescription,
  estimateFromImage,
} from '@infrastructure/calorie-estimator';

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
   * POST /api/upload/cloudinary/sign
   * Devuelve la firma necesaria para que la app móvil haga un upload firmado a Cloudinary.
   * Body (opcional): { folder?: string }
   */
  async cloudinarySign(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!env.CLOUDINARY_CLOUD_NAME) {
        throw new BusinessRuleError('Cloudinary no está configurado en el servidor');
      }

      const folder = String(req.body?.folder || 'dkfitt/consumo_adicional/temp');
      const timestamp = Math.floor(Date.now() / 1000);

      // firmar los parámetros esenciales
      const paramsToSign: Record<string, any> = { timestamp, folder };
      // cloudinary.utils.api_sign_request está disponible en la v2
      // pero en algunas instalaciones puede requerir pasar explicitamente la API secret
      // Usamos el util que expone el SDK
      // @ts-ignore - utils may not be typed in ambient declarations
      const signature = (cloudinary as any).utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET || '');

      ok(res, {
        api_key: process.env.CLOUDINARY_API_KEY || '',
        timestamp,
        signature,
        folder,
      });
    } catch (error) { next(error); }
  },

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
      const descripcion = String(req.body?.descripcion_alimento || '').trim();

      let estimacion = await estimateFromImage(file.path, descripcion);
      if (!estimacion.calorias_estimadas && descripcion.length > 0) {
        estimacion = await estimateFromDescription(descripcion);
      }

      ok(res, {
        url:       file.path,
        public_id: file.filename,
        mensaje:   'Foto del consumo subida correctamente',
        estimacion,
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

      const result = await cloudinary.uploader.destroy(publicId) as { result?: string };

      if (result.result === 'ok') {
        ok(res, { eliminado: true }, 'Imagen eliminada correctamente');
      } else {
        ok(res, { eliminado: false }, 'La imagen no existe o ya fue eliminada');
      }

    } catch (error) { next(error); }
  },

  /**
   * GET /api/upload/images
   * Obtiene la lista de imágenes subidas a Cloudinary por categoría/carpeta.
   * Solo nutricionistas y administradores.
   */
  async listImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const folderType = String(req.query.type || 'alimentos'); // alimentos, platos, ejercicios, consumo_adicional
      let prefix = 'dkfitt/alimentos';
      if (folderType === 'platos') {
        prefix = 'dkfitt/platos';
      } else if (folderType === 'ejercicios') {
        prefix = 'dkfitt/ejercicios';
      } else if (folderType === 'consumo_adicional') {
        prefix = 'dkfitt/consumo_adicional';
      }

      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 100);
      const nextCursor = req.query.next_cursor as string | undefined;

      const result = await (cloudinary as any).api.resources({
        type: 'upload',

        prefix: prefix,
        max_results: limit,
        next_cursor: nextCursor,
      });

      ok(res, {
        resources: (result.resources || []).map((r: any) => ({
          public_id: r.public_id,
          url: r.secure_url || r.url,
          format: r.format,
          created_at: r.created_at,
          bytes: r.bytes,
        })),
        next_cursor: result.next_cursor || null,
      });
    } catch (error) { next(error); }
  },

};