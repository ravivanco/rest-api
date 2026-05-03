import { NextFunction, Request, Response } from 'express';
import { ok } from '@utils/response';
import { menusDiariosService } from '../service/menus-diarios.service';
import { UpdateMenuPlatoDto } from '../dto/update-plato.dto';

export const menusDiariosController = {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const menuId = parseInt(String(req.params.id), 10);
      const result = await menusDiariosService.getMenuById(menuId);
      ok(res, result);
    } catch (error) {
      next(error);
    }
  },

  async replacePlato(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const menuId = parseInt(String(req.params.id), 10);
      const payload = req.body as UpdateMenuPlatoDto;
      const result = await menusDiariosService.replacePlato(
        menuId,
        payload.id_plato,
        req.user!.id,
        'cambio_manual',
      );
      ok(res, result, 'Plato del menú actualizado');
    } catch (error) {
      next(error);
    }
  },
};
