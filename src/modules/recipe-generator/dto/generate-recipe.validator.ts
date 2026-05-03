import { z } from 'zod';

export const GenerateRecipeSchema = z.object({
  id_perfil: z
    .number({ message: 'El id_perfil es requerido' })
    .int('El id_perfil debe ser un entero')
    .positive('El id_perfil debe ser positivo'),

  id_evaluacion: z
    .number({ message: 'El id_evaluacion es requerido' })
    .int('El id_evaluacion debe ser un entero')
    .positive('El id_evaluacion debe ser positivo'),

  id_tiempo_comida: z
    .number({ message: 'El id_tiempo_comida es requerido' })
    .int('El id_tiempo_comida debe ser un entero')
    .positive('El id_tiempo_comida debe ser positivo'),

  tiempo_comida_nombre: z.enum(
    ['desayuno', 'media_manana', 'almuerzo', 'media_tarde', 'cena'],
    { message: 'El tiempo_comida_nombre es invalido' },
  ),

  calorias_objetivo: z
    .number()
    .int('Las calorias_objetivo deben ser un entero')
    .positive('Las calorias_objetivo deben ser positivas')
    .optional(),

  id_dia_plan: z
    .number()
    .int('El id_dia_plan debe ser un entero')
    .positive('El id_dia_plan debe ser positivo')
    .optional(),
});

export type GenerateRecipeInput = z.infer<typeof GenerateRecipeSchema>;
