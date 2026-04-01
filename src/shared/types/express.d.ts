import { Role } from '@shared/constants/roles';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: Role;
        id_perfil: number | null;
        estado: string;
      };
    }
  }
}

export {};