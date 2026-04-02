import { Request, Response, NextFunction } from 'express';
import { nutritionPlansService }           from '../service/nutrition-plans.service';
import { ok, created }                     from '@utils/response';
import {
  CreatePlanDto,
  ActivatePlanDto,
  CreateWeekDto,
  CreateMenuDto,
  CreateDailyExerciseDto,
} from '../dto/nutrition-plans.dto';

export const nutritionPlansController = {

  /**
   * POST /api/nutrition-plans/patient/:perfilId
   * Crear nuevo plan para un paciente.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.perfilId), 10);
      const data     = req.body as CreatePlanDto;
      const plan     = await nutritionPlansService.createPlan(req.user!.id, perfilId, data);
      created(res, plan, 'Plan nutricional creado en estado pendiente');
    } catch (error) { next(error); }
  },


  /**
   * GET /api/nutrition-plans/patient/:perfilId
   * Historial de planes de un paciente.
   */
  async getPatientPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const perfilId = parseInt(String(req.params.perfilId), 10);
      const plans    = await nutritionPlansService.getPatientPlans(perfilId);
      ok(res, plans);
    } catch (error) { next(error); }
  },


  /**
   * GET /api/nutrition-plans/:id
   * Detalle de un plan.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await nutritionPlansService.getPlanById(parseInt(String(req.params.id), 10));
      ok(res, plan);
    } catch (error) { next(error); }
  },


  /**
   * PATCH /api/nutrition-plans/:id/activate
   * Activa el plan con fecha de inicio.
   */
  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as ActivatePlanDto;
      const plan = await nutritionPlansService.activatePlan(parseInt(String(req.params.id), 10), data);
      ok(res, plan, 'Plan activado. El módulo Mi Plan está habilitado para el paciente.');
    } catch (error) { next(error); }
  },


  /**
   * PATCH /api/nutrition-plans/:id/suspend
   * Suspende el plan activo.
   */
  async suspend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await nutritionPlansService.suspendPlan(parseInt(String(req.params.id), 10));
      ok(res, plan, 'Plan suspendido. El paciente ya no podrá ver su plan en la app.');
    } catch (error) { next(error); }
  },


  /**
   * PATCH /api/nutrition-plans/:id/reactivate
   * Reactiva un plan suspendido.
   */
  async reactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await nutritionPlansService.reactivatePlan(parseInt(String(req.params.id), 10));
      ok(res, plan, 'Plan reactivado. El paciente puede ver su plan nuevamente.');
    } catch (error) { next(error); }
  },


  /**
   * PATCH /api/nutrition-plans/:id/lock-module
   * Bloquea el módulo Mi Plan.
   */
  async lockModule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await nutritionPlansService.lockModule(parseInt(String(req.params.id), 10));
      ok(res, plan, 'Módulo Mi Plan bloqueado para el paciente.');
    } catch (error) { next(error); }
  },


  /**
   * PATCH /api/nutrition-plans/:id/unlock-module
   * Desbloquea el módulo Mi Plan.
   */
  async unlockModule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await nutritionPlansService.unlockModule(parseInt(String(req.params.id), 10));
      ok(res, plan, 'Módulo Mi Plan desbloqueado para el paciente.');
    } catch (error) { next(error); }
  },


  /**
   * GET /api/nutrition-plans/me/active
   * El paciente consulta su plan activo completo desde la app móvil.
   */
  async getActivePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await nutritionPlansService.getActivePlan(req.user!.id_perfil!);
      ok(res, result);
    } catch (error) { next(error); }
  },


  /**
   * POST /api/nutrition-plans/:planId/weeks
   * Crea una semana dentro del plan.
   */
  async createWeek(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const planId = parseInt(String(req.params.planId), 10);
      const data   = req.body as CreateWeekDto;
      const week   = await nutritionPlansService.createWeek(planId, data);
      created(res, week, 'Semana creada dentro del plan');
    } catch (error) { next(error); }
  },


  /**
   * GET /api/nutrition-plans/:planId/weeks
   * Lista las semanas de un plan.
   */
  async getWeeks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const weeks = await nutritionPlansService.getWeeksByPlan(parseInt(String(req.params.planId), 10));
      ok(res, weeks);
    } catch (error) { next(error); }
  },


  /**
   * POST /api/nutrition-plans/weeks/:weekId/days/:day/menus
   * Asigna un menú a un día y tiempo de comida.
   */
  async createMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const weekId   = parseInt(String(req.params.weekId), 10);
      const dia      = String(req.params.day);
      const fecha    = req.query.fecha as string ?? new Date().toISOString().split('T')[0];
      const data     = req.body as CreateMenuDto;
      const result   = await nutritionPlansService.createMenu(weekId, dia, fecha, data);
      created(res, result, 'Menú asignado al día del plan');
    } catch (error) { next(error); }
  },


  /**
   * POST /api/nutrition-plans/weeks/:weekId/days/:day/exercises
   * Asigna un ejercicio a un día del plan.
   */
  async createDailyExercise(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const weekId = parseInt(String(req.params.weekId), 10);
      const dia    = String(req.params.day);
      const fecha  = req.query.fecha as string ?? new Date().toISOString().split('T')[0];
      const data   = req.body as CreateDailyExerciseDto;
      const result = await nutritionPlansService.createDailyExercise(weekId, dia, fecha, data);
      created(res, result, 'Ejercicio asignado al día del plan');
    } catch (error) { next(error); }
  },


  /**
   * DELETE /api/nutrition-plans/weeks/:weekId/days/:day/exercises/:exId
   * Elimina un ejercicio de un día del plan.
   */
  async removeDailyExercise(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const weekId           = parseInt(String(req.params.weekId), 10);
      const dia              = String(req.params.day);
      const ejercicioDiarioId = parseInt(String(req.params.exId), 10);
      await nutritionPlansService.removeDailyExercise(weekId, dia, ejercicioDiarioId);
      ok(res, null, 'Ejercicio eliminado del día');
    } catch (error) { next(error); }
  },

};