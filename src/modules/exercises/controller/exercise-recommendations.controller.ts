import { Request, Response, NextFunction } from 'express';
import { exerciseRecommendationsService } from '../service/exercise-recommendations.service';
import { ok } from '@utils/response';

export const exerciseRecommendationsController = {
  /**
   * GET /api/exercise-recommendations
   */
  async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { calories } = req.query;

      if (!calories) {
        res.status(400).json({
          success: false,
          error: {
            message: 'El parámetro calories es requerido en la consulta.'
          }
        });
        return;
      }

      const parsedCalories = parseInt(String(calories), 10);
      if (isNaN(parsedCalories) || parsedCalories <= 0) {
        res.status(400).json({
          success: false,
          error: {
            message: 'El parámetro calories debe ser un número entero positivo.'
          }
        });
        return;
      }

      const perfilId = req.user!.id_perfil!;
      const recommendations = await exerciseRecommendationsService.getRecommendations(perfilId, parsedCalories);

      ok(res, {
        calorias_a_compensar: parsedCalories,
        recomendaciones: recommendations,
      });
    } catch (error) {
      next(error);
    }
  }
};
