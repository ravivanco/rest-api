import { z } from 'zod';

/**
 * DTO de registro de paciente.
 * Valida todos los campos requeridos para crear una cuenta nueva.
 */
export const RegisterDto = z.object({
  correo_institucional: z
    .string({ message: 'El correo es requerido' })
    .email('Formato de correo inválido')
    .max(150, 'El correo no puede superar 150 caracteres')
    .transform(val => val.toLowerCase().trim()),

  contrasena: z
    .string({ message: 'La contraseña es requerida' })
    .min(8,   'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede superar 128 caracteres')
    .regex(/[A-Z]/,              'Debe contener al menos una mayúscula')
    .regex(/[a-z]/,              'Debe contener al menos una minúscula')
    .regex(/[0-9]/,              'Debe contener al menos un número')
    .regex(/[!@#$%^&*()_+\-=]/, 'Debe contener al menos un carácter especial'),

  nombres: z
    .string({ message: 'Los nombres son requeridos' })
    .min(2,   'Los nombres deben tener al menos 2 caracteres')
    .max(100, 'Los nombres no pueden superar 100 caracteres')
    .trim(),

  apellidos: z
    .string({ message: 'Los apellidos son requeridos' })
    .min(2,   'Los apellidos deben tener al menos 2 caracteres')
    .max(100, 'Los apellidos no pueden superar 100 caracteres')
    .trim(),

  edad: z
    .number({ message: 'La edad es requerida' })
    .int('La edad debe ser un número entero')
    .min(16, 'La edad mínima es 16 años')
    .max(99, 'La edad máxima es 99 años'),

  sexo: z.enum(['M', 'F', 'O'] as const, {
    message: "El sexo debe ser 'M', 'F' u 'O'",
  }),

    fecha_nacimiento: z
    .string({ message: 'La fecha de nacimiento es requerida' })
    .regex(/^\d{2}\/\d{2}\/\d{4}$|^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha: DD/MM/YYYY o YYYY-MM-DD')
    .transform(val => {
      // Convertir DD/MM/YYYY a YYYY-MM-DD
      if (val.includes('/')) {
        const [day, month, year] = val.split('/');
        return `${year}-${month}-${day}`;
      }
      return val;
    }),
});  

// Tipo TypeScript inferido del schema
export type RegisterDto = z.infer<typeof RegisterDto>;


/**
 * DTO de inicio de sesión.
 * Solo necesita correo y contraseña.
 */
export const LoginDto = z.object({
  correo_institucional: z
    .string({ message: 'El correo es requerido' })
    .email('Formato de correo inválido')
    .transform(val => val.toLowerCase().trim()),

  contrasena: z
    .string({ message: 'La contraseña es requerida' })
    .min(1, 'La contraseña es requerida'),
});

export type LoginDto = z.infer<typeof LoginDto>;


/**
 * DTO para renovar el access token usando el refresh token.
 */
export const RefreshTokenDto = z.object({
  refresh_token: z
    .string({ message: 'El refresh token es requerido' })
    .min(1, 'El refresh token no puede estar vacío'),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenDto>;


/**
 * DTO para cerrar sesión.
 */
export const LogoutDto = z.object({
  refresh_token: z
    .string({ message: 'El refresh token es requerido' })
    .min(1, 'El refresh token no puede estar vacío'),
});

export type LogoutDto = z.infer<typeof LogoutDto>;


/**
 * DTO para cambiar contraseña.
 */
export const ChangePasswordDto = z.object({
  contrasena_actual: z
    .string({ message: 'La contraseña actual es requerida' })
    .min(1),

  contrasena_nueva: z
    .string({ message: 'La contraseña nueva es requerida' })
    .min(8,   'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña no puede superar 128 caracteres')
    .regex(/[A-Z]/,              'Debe contener al menos una mayúscula')
    .regex(/[a-z]/,              'Debe contener al menos una minúscula')
    .regex(/[0-9]/,              'Debe contener al menos un número')
    .regex(/[!@#$%^&*()_+\-=]/, 'Debe contener al menos un carácter especial'),
});

export type ChangePasswordDto = z.infer<typeof ChangePasswordDto>;