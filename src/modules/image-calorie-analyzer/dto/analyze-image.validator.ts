import { z } from 'zod';

export const AnalyzeImageSchema = z.object({
  // Base64 desde la app móvil
  imagen_base64: z
    .string()
    .min(100, 'imagen_base64 no parece válida')
    .optional(),

  // URL desde la web
  imagen_url: z
    .string()
    .url('imagen_url debe ser una URL válida')
    .optional(),

  descripcion_alimento: z
    .string()
    .max(200)
    .trim()
    .optional(),
}).refine(
  (data) => data.imagen_base64 || data.imagen_url,
  {
    message: 'Debes enviar imagen_base64 o imagen_url',
    path: ['imagen_base64'],
  }
);

export type AnalyzeImageInput = z.infer<typeof AnalyzeImageSchema>;