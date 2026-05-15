import { v2 as cloudinary } from 'cloudinary';
import { env }              from './env';

/**
 * Configuración de Cloudinary para subida de imágenes.
 * Usamos las variables de entorno validadas en env.ts.
 */
if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key:    env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure:     true, // siempre usar HTTPS
  });
} else {
  console.warn('⚠️ Cloudinary no fue inicializado porque faltan credenciales.');
}

export default cloudinary;