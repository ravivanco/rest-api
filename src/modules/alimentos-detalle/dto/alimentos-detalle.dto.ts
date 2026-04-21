import { z } from 'zod';

const nonNegativeNumber = (fieldName: string) =>
  z.coerce
    .number({ message: `${fieldName} debe ser un numero valido` })
    .min(0, `${fieldName} no puede ser negativo`);

const optionalNutrient = (fieldName: string) =>
  nonNegativeNumber(fieldName).optional().nullable();

export const CreateAlimentoDetalleDto = z.object({
  nombre: z
    .string({ message: 'El nombre es requerido' })
    .min(1, 'El nombre es requerido')
    .max(200, 'El nombre no puede superar 200 caracteres')
    .trim(),

  categoria: z
    .string({ message: 'La categoria es requerida' })
    .min(1, 'La categoria es requerida')
    .max(100, 'La categoria no puede superar 100 caracteres')
    .trim(),

  calorias: nonNegativeNumber('Calorias'),
  proteinas: optionalNutrient('Proteinas'),
  grasas: optionalNutrient('Grasas'),
  carbohidratos: optionalNutrient('Carbohidratos'),
  fibra: optionalNutrient('Fibra'),
  ags: optionalNutrient('AGS'),
  agm: optionalNutrient('AGM'),
  agpi: optionalNutrient('AGPI'),
  colesterol: optionalNutrient('Colesterol'),
  calcio: optionalNutrient('Calcio'),
  fosforo: optionalNutrient('Fosforo'),
  hierro: optionalNutrient('Hierro'),
  potasio: optionalNutrient('Potasio'),
  sodio: optionalNutrient('Sodio'),
  zinc: optionalNutrient('Zinc'),
  vitamina_c: optionalNutrient('Vitamina C'),
  vitamina_a: optionalNutrient('Vitamina A'),
  folatos: optionalNutrient('Folatos'),
  vitamina_b12: optionalNutrient('Vitamina B12'),

  fuente: z
    .string()
    .max(120, 'La fuente no puede superar 120 caracteres')
    .trim()
    .optional()
    .nullable(),
});

export type CreateAlimentoDetalleDto = z.infer<typeof CreateAlimentoDetalleDto>;

export const UpdateAlimentoDetalleDto = CreateAlimentoDetalleDto.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Debes enviar al menos un campo para actualizar' },
);

export type UpdateAlimentoDetalleDto = z.infer<typeof UpdateAlimentoDetalleDto>;

export const ListAlimentosDetalleQueryDto = z.object({
  search: z.string().trim().optional(),
  categoria: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListAlimentosDetalleQueryDto = z.infer<typeof ListAlimentosDetalleQueryDto>;
