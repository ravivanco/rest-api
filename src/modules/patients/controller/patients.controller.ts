import { Request, Response, NextFunction } from 'express';
import { patientsService } from '../service/patients.service';
import { ok, paginated }   from '@utils/response';
import { ListPatientsDto } from '../dto/patients.dto';

export const patientsController = {

  /**
   * GET /api/patients
   * Lista todos los pacientes con filtros. Solo nutricionista.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = req.query as unknown as ListPatientsDto;
      const result  = await patientsService.listPatients({
        search:               filters.search,
        estado_plan:          filters.estado_plan,
        adherencia:           filters.adherencia,
        formulario_completado: filters.formulario_completado,
        page:                 Number(filters.page)  || 1,
        limit:                Number(filters.limit) || 20,
      });
      paginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  },


  /**
   * GET /api/patients/me
   * Datos del paciente autenticado. Solo paciente.
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patient = await patientsService.getMyProfile(req.user!.id_perfil!);
      ok(res, patient);
    } catch (error) {
      next(error);
    }
  },


  /**
   * GET /api/patients/:id
   * Ficha completa de un paciente. Solo nutricionista.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId  = parseInt(String(req.params.id), 10);
      const patient = await patientsService.getPatientById(userId);
      ok(res, patient);
    } catch (error) {
      next(error);
    }
  },

};