import { Request, Response, NextFunction } from 'express';
import {
  CreateAlimentoDetalleDto,
  ListAlimentosDetalleQueryDto,
  UpdateAlimentoDetalleDto,
} from '../dto/alimentos-detalle.dto';
import { alimentosDetalleService } from '../service/alimentos-detalle.service';
import { ValidationError } from '@errors/AppError';
import { created, noContent, ok } from '@utils/response';

const parseId = (value: string): number => {
  const id = parseInt(value, 10);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError('El id debe ser un entero positivo');
  }

  return id;
};

export const alimentosDetalleController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedQuery = ListAlimentosDetalleQueryDto.safeParse(req.query);

      if (!parsedQuery.success) {
        const firstError = parsedQuery.error.issues[0]?.message ?? 'Parametros de consulta invalidos';
        throw new ValidationError(firstError);
      }

      const result = await alimentosDetalleService.list(parsedQuery.data);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alimento = await alimentosDetalleService.getById(parseId(String(req.params.id)));
      ok(res, alimento);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alimento = await alimentosDetalleService.create(req.body as CreateAlimentoDetalleDto);
      created(res, alimento, 'Alimento detalle creado exitosamente');
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alimento = await alimentosDetalleService.update(
        parseId(String(req.params.id)),
        req.body as UpdateAlimentoDetalleDto,
      );

      ok(res, alimento, 'Alimento detalle actualizado');
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await alimentosDetalleService.remove(parseId(String(req.params.id)));
      noContent(res);
    } catch (error) {
      next(error);
    }
  },
};
