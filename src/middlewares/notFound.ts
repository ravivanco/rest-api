import { Request, Response } from 'express';

/**
 * Middleware para rutas que no existen.
 * Se registra después de todas las rutas en app.ts.
 * Si ninguna ruta coincidió, este responde con 404.
 */
export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code:    'ROUTE_NOT_FOUND',
      message: `La ruta ${req.method} ${req.originalUrl} no existe en esta API`,
    },
  });
};