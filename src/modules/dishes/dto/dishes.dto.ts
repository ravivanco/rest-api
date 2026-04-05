import { z } from 'zod';

/**
 * DTO para un ingrediente dentro de un plato.
 */
const IngredienteDto = z.object({
  id_alimento: z
    .number({ message: 'El ID del alimento es requerido' })
    .int()
    .positive(),

  cantidad_g: z
    .number({ message: 'La cantidad en gramos es requerida' })
    .int()
    .min(1,    'La cantidad mínima es 1 gramo')
    .max(5000, 'La cantidad máxima es 5000 gramos'),
});

/**
 * DTO para crear un plato con sus ingredientes.
 */
export const CreateDishDto = z.object({
  nombre: z
    .string({ message: 'El nombre es requerido' })
    .min(2,   'El nombre debe tener al menos 2 caracteres')
    .max(150, 'El nombre no puede superar 150 caracteres')
    .trim(),

  descripcion: z
    .string()
    .max(1000, 'La descripción no puede superar 1000 caracteres')
    .optional()
    .nullable(),

  modo_preparacion: z
    .string()
    .max(5000, 'El modo de preparación no puede superar 5000 caracteres')
    .optional()
    .nullable(),

  enlace_video: z
    .string()
    .url('El enlace del video debe ser una URL válida')
    .optional()
    .nullable(),

  tiempo_preparacion_min: z
    .number()
    .int()
    .min(1,   'El tiempo mínimo de preparación es 1 minuto')
    .max(1440, 'El tiempo máximo es 1440 minutos (24 horas)')
    .optional()
    .nullable(),

  // Ingredientes opcionales al crear — se pueden agregar después
  ingredientes: z
    .array(IngredienteDto)
    .optional()
    .default([]),
});
export type CreateDishDto = z.infer<typeof CreateDishDto>;

export const UpdateDishDto = CreateDishDto.partial();
export type UpdateDishDto = z.infer<typeof UpdateDishDto>;

/**
 * DTO para agregar o actualizar un ingrediente en un plato.
 */
export const UpsertIngredientDto = z.object({
  id_alimento: z
    .number({ message: 'El ID del alimento es requerido' })
    .int()
    .positive(),

  cantidad_g: z
    .number({ message: 'La cantidad es requerida' })
    .int()
    .min(1, 'La cantidad mínima es 1 gramo')
    .max(5000),
});
export type UpsertIngredientDto = z.infer<typeof UpsertIngredientDto>;

/**
 * Filtros para listar platos.
 */
export const ListDishesDto = z.object({
  search: z.string().optional(),
  activo: z.enum(['true', 'false']).optional(),
  page:   z.string().optional().transform(v => parseInt(v ?? '1')  || 1),
  limit:  z.string().optional().transform(v => Math.min(parseInt(v ?? '20') || 20, 100)),
});
export type ListDishesDto = z.infer<typeof ListDishesDto>;