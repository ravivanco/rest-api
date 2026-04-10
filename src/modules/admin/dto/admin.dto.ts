import { z } from 'zod';

const PASSWORD_REGEX = /[!@#$%^&*()_+\-=]/;

const horarioDiaSchema = z.object({
  inicio: z
    .string({ message: 'La hora de inicio es requerida' })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido. Usa HH:mm'),
  fin: z
    .string({ message: 'La hora de fin es requerida' })
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido. Usa HH:mm'),
});

const horarioAtencionSchema = z.record(z.string(), horarioDiaSchema);

export const AdminListUsersQueryDto = z.object({
  role: z.enum(['administrador', 'nutricionista', 'paciente']).optional(),
  status: z.enum(['activo', 'inactivo', 'suspendido']).optional(),
  search: z.string().trim().min(1).max(150).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['fecha_registro', 'nombres', 'rol']).default('fecha_registro'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type AdminListUsersQueryDto = z.infer<typeof AdminListUsersQueryDto>;

export const CreateNutritionistDto = z.object({
  correo_institucional: z
    .string({ message: 'El correo es requerido' })
    .email('Formato de correo inválido')
    .max(150, 'El correo no puede superar 150 caracteres')
    .transform((val) => val.toLowerCase().trim()),

  contrasena_temporal: z
    .string({ message: 'La contraseña temporal es requerida' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede superar 128 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(PASSWORD_REGEX, 'Debe contener al menos un carácter especial'),

  nombres: z
    .string({ message: 'Los nombres son requeridos' })
    .min(2, 'Los nombres deben tener al menos 2 caracteres')
    .max(100, 'Los nombres no pueden superar 100 caracteres')
    .trim(),

  apellidos: z
    .string({ message: 'Los apellidos son requeridos' })
    .min(2, 'Los apellidos deben tener al menos 2 caracteres')
    .max(100, 'Los apellidos no pueden superar 100 caracteres')
    .trim(),

  edad: z
    .number({ message: 'La edad es requerida' })
    .int('La edad debe ser un número entero')
    .min(16, 'La edad mínima es 16 años')
    .max(99, 'La edad máxima es 99 años'),

  sexo: z.enum(['M', 'F', 'O'], {
    message: "El sexo debe ser 'M', 'F' u 'O'",
  }),

  fecha_nacimiento: z
    .string({ message: 'La fecha de nacimiento es requerida' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Usa YYYY-MM-DD'),

  perfil_nutricionista: z.object({
    numero_registro_profesional: z
      .string({ message: 'El número de registro profesional es requerido' })
      .min(3, 'El número de registro profesional es inválido')
      .max(50, 'El número de registro profesional no puede superar 50 caracteres')
      .trim(),

    especialidad: z
      .string()
      .max(100, 'La especialidad no puede superar 100 caracteres')
      .trim()
      .optional()
      .nullable(),

    telefono_contacto: z
      .string()
      .max(20, 'El teléfono no puede superar 20 caracteres')
      .trim()
      .optional()
      .nullable(),

    foto_perfil_url: z
      .string()
      .url('La foto de perfil debe ser una URL válida')
      .optional()
      .nullable(),

    horario_atencion: horarioAtencionSchema.optional(),
  }),
});

export type CreateNutritionistDto = z.infer<typeof CreateNutritionistDto>;

export const UpdateAdminUserDto = z.object({
  nombres: z.string().min(2).max(100).trim().optional(),
  apellidos: z.string().min(2).max(100).trim().optional(),
  correo_institucional: z
    .string()
    .email('Formato de correo inválido')
    .max(150)
    .transform((val) => val.toLowerCase().trim())
    .optional(),
  edad: z.number().int().min(16).max(99).optional(),
  sexo: z.enum(['M', 'F', 'O']).optional(),
  fecha_nacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido. Usa YYYY-MM-DD')
    .optional(),

  perfil_nutricionista: z
    .object({
      numero_registro_profesional: z.string().min(3).max(50).trim().optional(),
      especialidad: z.string().max(100).trim().optional().nullable(),
      telefono_contacto: z.string().max(20).trim().optional().nullable(),
      foto_perfil_url: z.string().url().optional().nullable(),
      horario_atencion: horarioAtencionSchema.optional().nullable(),
    })
    .optional(),
})
.refine((data) => Object.keys(data).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

export type UpdateAdminUserDto = z.infer<typeof UpdateAdminUserDto>;

export const UpdateAdminUserStatusDto = z.object({
  estado: z.enum(['activo', 'inactivo', 'suspendido'], {
    message: "El estado debe ser 'activo', 'inactivo' o 'suspendido'",
  }),
});

export type UpdateAdminUserStatusDto = z.infer<typeof UpdateAdminUserStatusDto>;

export const AdminUserIdParamDto = z.object({
  id: z.coerce.number().int().positive(),
});

export type AdminUserIdParamDto = z.infer<typeof AdminUserIdParamDto>;

export const AdminResetPasswordDto = z.object({
  contrasena_temporal: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede superar 128 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(PASSWORD_REGEX, 'Debe contener al menos un carácter especial')
    .optional(),
});

export type AdminResetPasswordDto = z.infer<typeof AdminResetPasswordDto>;
