import { Request, Response, NextFunction } from 'express';
import { recipeGeneratorService } from '../service/recipe-generator.service';
import { created } from '@utils/response';
import { GenerateRecipeDto, GenerateWeekDto } from '../dto/generate-recipe.dto';

export const recipeGeneratorController = {

  /**
   * POST /api/recipe-generator/generate
   * Genera una receta personalizada con IA.
   */
  async generate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as GenerateRecipeDto;
      const result = await recipeGeneratorService.generateRecipe(payload);
      created(res, result, 'Receta generada exitosamente');
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/recipe-generator/generate-week
   * Genera el plan semanal completo (5 días × 5 tiempos = 25 recetas).
   */
  async generateWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as GenerateWeekDto;
      const result = await recipeGeneratorService.generateWeekPlan(payload);
      created(res, result, 'Plan semanal generado exitosamente');
    } catch (error) {
      next(error);
    }
  },

};
