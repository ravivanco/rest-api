import { z } from 'zod';

const CATEGORIAS_ALIMENTO = [
  'proteinas', 'carbohidratos', 'lacteos',
  'vegetales', 'frutas', 'grasas', 'otros'
] as const;

/**
 * DTO para crear o actualizar un alimento.
 */
export const CreateFoodDto = z.object({
  nombre: z
    .string({ message: 'El nombre es requerido' })
    .min(2,   'El nombre debe tener al menos 2 caracteres')
    .max(150, 'El nombre no puede superar 150 caracteres')
    .trim(),

  categoria: z.enum(CATEGORIAS_ALIMENTO, {
    message: `La categoría debe ser una de: ${CATEGORIAS_ALIMENTO.join(', ')}`,
  }),

  calorias_por_100g: z
    .number({ message: 'Las calorías son requeridas' })
    .int('Las calorías deben ser un número entero')
    .min(0,    'Las calorías no pueden ser negativas')
    .max(9000, 'Las calorías máximas por 100g son 9000 kcal'),

  carbohidratos_g: z
    .number()
    .min(0, 'Los carbohidratos no pueden ser negativos')
    .max(100, 'Los carbohidratos máximos son 100g por 100g de alimento')
    .default(0),

  proteinas_g: z
    .number()
    .min(0,   'Las proteínas no pueden ser negativas')
    .max(100, 'Las proteínas máximas son 100g por 100g de alimento')
    .default(0),

  grasas_g: z
    .number()
    .min(0,   'Las grasas no pueden ser negativas')
    .max(100, 'Las grasas máximas son 100g por 100g de alimento')
    .default(0),

  vitaminas: z
    .string()
    .max(300, 'Máximo 300 caracteres')
    .optional()
    .nullable(),

  minerales: z
    .string()
    .max(300, 'Máximo 300 caracteres')
    .optional()
    .nullable(),
});
export type CreateFoodDto = z.infer<typeof CreateFoodDto>;

export const UpdateFoodDto = CreateFoodDto.partial();
export type UpdateFoodDto = z.infer<typeof UpdateFoodDto>;

/**
 * Filtros para listar alimentos.
 */
export const ListFoodsDto = z.object({
  search:    z.string().optional(),
  categoria: z.enum(CATEGORIAS_ALIMENTO).optional(),
  activo:    z.enum(['true', 'false']).optional(),
  page:      z.string().optional().transform(v => parseInt(v ?? '1')  || 1),
  limit:     z.string().optional().transform(v => Math.min(parseInt(v ?? '20') || 20, 100)),
});
export type ListFoodsDto = z.infer<typeof ListFoodsDto>;