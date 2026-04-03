import { Request, Response, NextFunction }  from 'express';
import { additionalIntakeService }          from '../service/additional-intake.service';
import { ok, created }                      from '@utils/response';
import {
  CreateAdditionalIntakeDto,
  ConfirmIntakeDto,
} from '../dto/additional-intake.dto';

export const additionalIntakeController = {

  /**
   * POST /api/additional-intake
   * El paciente registra un consumo fuera del plan.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data   = req.body as CreateAdditionalIntakeDto;
      const result = await additionalIntakeService.registerIntake(
        req.user!.id_perfil!,
        data,
      );
      created(res, result,
        'Consumo registrado. Confirma para sumarlo a tu balance calórico del día.'
      );
    } catch (error) { next(error); }
  },


  /**
   * PATCH /api/additional-intake/:id/confirm
   * El paciente confirma el consumo y sus calorías se suman al balance.
   */
  async confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consumoId = parseInt(String(req.params.id), 10);
      const data      = req.body as ConfirmIntakeDto;
      const result    = await additionalIntakeService.confirmIntake(
        consumoId,
        req.user!.id_perfil!,
        data,
      );
      ok(res, result,
        result.ejercicios_compensatorios
          ? '¡Calorías sumadas! Tienes un exceso calórico — considera los ejercicios compensatorios.'
          : 'Consumo confirmado y calorías sumadas a tu balance del día.'
      );
    } catch (error) { next(error); }
  },


  /**
   * POST /api/additional-intake/:id/discard
   * El paciente descarta el consumo — no impacta el balance.
   */
  async discard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const consumoId = parseInt(String(req.params.id), 10);
      const result    = await additionalIntakeService.discardIntake(
        consumoId,
        req.user!.id_perfil!,
      );
      ok(res, result, 'Consumo descartado. No impacta tu balance calórico.');
    } catch (error) { next(error); }
  },


  /**
   * GET /api/additional-intake/me
   * El paciente ve sus propios consumos adicionales.
   */
  async getMyIntakes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q      = req.query;
      const result = await additionalIntakeService.getMyIntakes(
        req.user!.id_perfil!,
        {
          desde:      q.desde      as string | undefined,
          hasta:      q.hasta      as string | undefined,
          confirmado: q.confirmado as string | undefined,
          page:       parseInt(String(q.page), 10) || 1,
          limit:      parseInt(String(q.limit), 10) || 20,
        },
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },


  /**
   * GET /api/additional-intake/patient/:id
   * La nutricionista ve los consumos adicionales de un paciente.
   */
  async getPatientIntakes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const q        = req.query;
      const result   = await additionalIntakeService.getPatientIntakes(
        perfilId,
        {
          desde:      q.desde      as string | undefined,
          hasta:      q.hasta      as string | undefined,
          confirmado: q.confirmado as string | undefined,
          page:       parseInt(String(q.page), 10) || 1,
          limit:      parseInt(String(q.limit), 10) || 20,
        },
      );
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },


  /**
   * GET /api/additional-intake/patient/:id/impact
   * Análisis del impacto calórico de consumos adicionales.
   */
  async getImpact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.id), 10);
      const { desde, hasta } = req.query;
      const result = await additionalIntakeService.getImpact(
        perfilId,
        desde as string | undefined,
        hasta as string | undefined,
      );
      ok(res, result);
    } catch (error) { next(error); }
  },

};