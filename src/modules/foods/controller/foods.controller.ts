import { Request, Response, NextFunction } from 'express';
import { foodsService }    from '../service/foods.service';
import { ok, created }     from '@utils/response';
import { CreateFoodDto, UpdateFoodDto, CreateCustomFoodDto } from '../dto/foods.dto';

export const foodsController = {

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q      = req.query;
      
      let idPerfilVal = q.id_perfil ? parseInt(String(q.id_perfil), 10) : undefined;
      if (!idPerfilVal && req.user && req.user.id_perfil) {
        idPerfilVal = req.user.id_perfil;
      }

      const result = await foodsService.list({
        search:    q.search    as string | undefined,
        categoria: q.categoria as string | undefined,
        activo:    q.activo    as string | undefined,
        id_perfil: idPerfilVal,
        page:      parseInt(String(q.page), 10) || 1,
        limit:     parseInt(String(q.limit), 10) || 20,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const food = await foodsService.getById(parseInt(String(req.params.id), 10));
      ok(res, food);
    } catch (error) { next(error); }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const food = await foodsService.create(req.body as CreateFoodDto);
      created(res, food, 'Alimento creado exitosamente');
    } catch (error) { next(error); }
  },

  async createCustom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = req.user!.id_perfil!;
      const food = await foodsService.createCustom({
        ...req.body,
        id_perfil: perfilId
      });
      created(res, food, 'Alimento personalizado creado exitosamente');
    } catch (error) { next(error); }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const food = await foodsService.update(parseInt(String(req.params.id), 10), req.body as UpdateFoodDto);
      ok(res, food, 'Alimento actualizado');
    } catch (error) { next(error); }
  },

  async setStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activo = req.body.activo === true || req.body.activo === 'true';
      const food   = await foodsService.setStatus(parseInt(String(req.params.id), 10), activo);
      ok(res, food, activo ? 'Alimento activado' : 'Alimento desactivado');
    } catch (error) { next(error); }
  },

};