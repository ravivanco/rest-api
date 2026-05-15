import { NextFunction, Request, Response } from 'express';
import { ok } from '@utils/response';
import { AnalyzeImageDto } from '../dto/analyze-image.dto';
import { imageCalorieAnalyzerService } from '../service/image-calorie-analyzer.service';

export const imageCalorieAnalyzerController = {
  async analyze(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as AnalyzeImageDto;
      const result = await imageCalorieAnalyzerService.analyze(payload);
      ok(res, result, 'Imagen analizada correctamente');
    } catch (error) {
      next(error);
    }
  },
};
