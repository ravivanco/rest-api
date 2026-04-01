// Roles disponibles en el sistema
export type Role = 'paciente' | 'nutricionista' | 'administrador';

// Datos del usuario que viven en req.user (vienen del JWT)
export interface AuthUser {
  id: number;
  email: string;
  role: Role;
  id_perfil: number | null;
  estado: string;
}

// Parámetros de paginación
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

// Respuesta paginada
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}