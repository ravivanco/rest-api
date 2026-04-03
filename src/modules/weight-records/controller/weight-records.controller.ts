import { Request, Response, NextFunction } from 'express';
import { weightRecordsService } from '../service/weight-records.service';
import { ok, created } from '@utils/response';
import { CreateWeightRecordDto } from '../dto/weight-records.dto';

export const weightRecordsController = {

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { peso_kg } = req.body as CreateWeightRecordDto;
      const result = await weightRecordsService.createRecord(req.user!.id_perfil!, peso_kg);
      created(res, result, 'Peso registrado correctamente');
    } catch (error) { next(error); }
  },

  async getMyHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page   = parseInt(String(req.query.page), 10) || 1;
      const limit  = parseInt(String(req.query.limit), 10) || 30;
      const result = await weightRecordsService.getHistory(req.user!.id_perfil!, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async getPatientHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const page     = parseInt(String(req.query.page), 10) || 1;
      const limit    = parseInt(String(req.query.limit), 10) || 30;
      const result   = await weightRecordsService.getHistory(perfilId, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },

  async getMyChart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = req.query.period as string ?? '30d';
      const result = await weightRecordsService.getChartData(req.user!.id_perfil!, period);
      ok(res, result);
    } catch (error) { next(error); }
  },

  async getPatientChart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const period   = req.query.period as string ?? '30d';
      const result   = await weightRecordsService.getChartData(perfilId, period);
      ok(res, result);
    } catch (error) { next(error); }
  },

};