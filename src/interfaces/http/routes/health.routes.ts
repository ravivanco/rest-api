import { Router, Request, Response } from 'express';
import { pool } from '@infrastructure/database/pool';

const healthRoutes = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Estado del servidor y base de datos
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Servidor operativo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     timestamp:
 *                       type: string
 *                     database:
 *                       type: string
 *                       example: connected
 *                     version:
 *                       type: string
 *                       example: 1.0.0
 */
healthRoutes.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
      },
    });
  } catch {
    res.status(503).json({
      success: false,
      data: {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      },
    });
  }
});

export { healthRoutes };