import { NextFunction, Request, Response } from 'express';
import { ok } from '@utils/response';
import { sugerenciasService } from '../service/sugerencias.service';
import {
  ReviewSuggestionDto,
  SuggestionFiltersSchema,
} from '../dto/sugerencia.dto';

export const sugerenciasController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = SuggestionFiltersSchema.safeParse(req.query);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }

      const result = await sugerenciasService.list(parsed.data);
      ok(res, result);
    } catch (error) {
      next(error);
    }
  },

  async review(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const suggestionId = parseInt(String(req.params.id), 10);
      const payload = req.body as ReviewSuggestionDto;
      const result = await sugerenciasService.review(
        suggestionId,
        payload.accion,
        req.user!.id,
      );
      ok(res, result, 'Sugerencia procesada correctamente');
    } catch (error) {
      next(error);
    }
  },
};
