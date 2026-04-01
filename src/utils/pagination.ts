import { Request } from 'express';
import { PaginationParams } from '../types/common.types';

// Extrae y valida los parámetros de paginación del query string
export const getPaginationParams = (req: Request): PaginationParams => {
  const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};