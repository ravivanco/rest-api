import { z } from 'zod';

export const AnalyzeImageSchema = z.object({
  imagen_url: z
    .string({ message: 'La imagen_url es requerida' })
    .url('imagen_url debe ser una URL valida'),

  descripcion_alimento: z
    .string()
    .max(200, 'descripcion_alimento no puede superar 200 caracteres')
    .trim()
    .optional(),
});

export type AnalyzeImageInput = z.infer<typeof AnalyzeImageSchema>;
