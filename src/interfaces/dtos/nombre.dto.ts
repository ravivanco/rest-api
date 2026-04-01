import { z } from 'zod';

// Define qué campos acepta y con qué reglas
export const RegisterDto = z.object({
  correo_institucional: z.string().email(),
  contrasena: z.string().min(8),
});