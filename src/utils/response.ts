import { Response } from 'express';

// Respuesta exitosa 200
export const ok = (res: Response, data: unknown, message?: string) => {
  return res.status(200).json({
    success: true,
    data,
    ...(message && { message }),
  });
};

// Respuesta de creación 201
export const created = (res: Response, data: unknown, message?: string) => {
  return res.status(201).json({
    success: true,
    data,
    ...(message && { message }),
  });
};

// Respuesta sin contenido 204
export const noContent = (res: Response) => {
  return res.status(204).send();
};

// Respuesta paginada 200
export const paginated = (
  res: Response,
  data: unknown[],
  meta: { page: number; limit: number; total: number }
) => {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      ...meta,
      total_pages: Math.ceil(meta.total / meta.limit),
    },
  });
};