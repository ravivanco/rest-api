import multer                                from 'multer';
import { CloudinaryStorage }                 from 'multer-storage-cloudinary';
import cloudinary                            from './cloudinary';

/**
 * Límite de tamaño de archivo: 5MB.
 * Suficiente para fotos de comida de buena calidad.
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB en bytes

/**
 * Tipos de archivo permitidos.
 */
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];

/**
 * Storage para imágenes de ALIMENTOS.
 * Se guardan en la carpeta dkfitt/alimentos en Cloudinary.
 */
const foodStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'dkfitt/alimentos',
    allowed_formats: ALLOWED_FORMATS,
    transformation:  [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
  } as object,
});

/**
 * Storage para imágenes de PLATOS/MENÚS.
 */
const dishStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'dkfitt/platos',
    allowed_formats: ALLOWED_FORMATS,
    transformation:  [{ width: 800, height: 600, crop: 'limit', quality: 'auto' }],
  } as object,
});

/**
 * Storage para imágenes de EJERCICIOS.
 */
const exerciseStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'dkfitt/ejercicios',
    allowed_formats: ALLOWED_FORMATS,
    transformation:  [{ width: 800, height: 600, crop: 'limit', quality: 'auto' }],
  } as object,
});

/**
 * Storage para CONSUMO ADICIONAL (foto de comida del paciente).
 */
const intakeStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'dkfitt/consumo_adicional',
    allowed_formats: ALLOWED_FORMATS,
    transformation:  [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
  } as object,
});

/**
 * Filtro de tipos de archivo.
 * Rechaza archivos que no sean imágenes.
 */
const fileFilter = (
  _req:  Express.Request,
  file:  Express.Multer.File,
  cb:    multer.FileFilterCallback,
) => {
  const mimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (mimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan: JPG, PNG, WEBP'));
  }
};

// ── Instancias de multer por categoría ───────────────────────────────────────

export const uploadFood = multer({
  storage:   foodStorage,
  limits:    { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export const uploadDish = multer({
  storage:   dishStorage,
  limits:    { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export const uploadExercise = multer({
  storage:   exerciseStorage,
  limits:    { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export const uploadIntake = multer({
  storage:   intakeStorage,
  limits:    { fileSize: MAX_FILE_SIZE },
  fileFilter,
});