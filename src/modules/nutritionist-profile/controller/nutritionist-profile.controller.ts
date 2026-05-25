import { NextFunction, Request, Response } from 'express';
import { ok } from '@utils/response';
import { UpdateNutritionistInfoDto } from '../../admin/dto/admin.dto';
import { nutritionistProfileService } from '../service/nutritionist-profile.service';

export const nutritionistProfileController = {
  async getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await nutritionistProfileService.getMyProfile(req.user!.id);
      ok(res, result);
    } catch (error) {
      next(error);
    }
  },

  async updateMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as UpdateNutritionistInfoDto;
      const result = await nutritionistProfileService.updateMyProfile(req.user!.id, payload);
      ok(res, result, 'Perfil actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },
};
