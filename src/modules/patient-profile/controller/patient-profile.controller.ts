import { Request, Response, NextFunction }  from 'express';
import { patientProfileService }            from '../service/patient-profile.service';
import { ok, noContent }                    from '@utils/response';
import { SaveProfileFormDto, AddCondicionDto, AddPreferenciaDto, AddDeporteDto } from '../dto/patient-profile.dto';

export const patientProfileController = {

  /**
   * GET /api/patient-profile/me
   * El paciente ve su propio formulario completo.
   */
  async getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await patientProfileService.getFullProfile(req.user!.id_perfil!);
      ok(res, profile);
    } catch (error) {
      next(error);
    }
  },


  /**
   * GET /api/patient-profile/medical-conditions
   * Catálogo de condiciones médicas disponibles.
   */
  async getCatalogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const condiciones = await patientProfileService.getCatalogoCondiciones();
      ok(res, condiciones);
    } catch (error) {
      next(error);
    }
  },


  /**
   * GET /api/patient-profile/:patientId
   * La nutricionista ve el formulario de un paciente específico.
   */
  async getByPatientId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId  = parseInt(String(req.params.patientId), 10);
      const profile = await patientProfileService.getProfileByUserId(userId);
      ok(res, profile);
    } catch (error) {
      next(error);
    }
  },


  /**
   * PUT /api/patient-profile/me
   * El paciente guarda su formulario completo.
   * Marca formulario_completado = true.
   */
  async saveMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data    = req.body as SaveProfileFormDto;
      const perfilId = req.user!.id_perfil!;

      const updated = await patientProfileService.saveFullForm(perfilId, data);
      ok(res, updated, 'Perfil actualizado. La nutricionista revisará tu información.');
    } catch (error) {
      next(error);
    }
  },


  /**
   * POST /api/patient-profile/me/conditions
   * Agrega una condición médica al perfil del paciente.
   */
  async addCondicion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id_condicion } = req.body as AddCondicionDto;
      await patientProfileService.addCondicion(req.user!.id_perfil!, id_condicion);
      ok(res, null, 'Condición médica agregada');
    } catch (error) {
      next(error);
    }
  },


  /**
   * DELETE /api/patient-profile/me/conditions/:id
   * Elimina una condición médica del perfil.
   */
  async removeCondicion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idCondicion = parseInt(String(req.params.id), 10);
      await patientProfileService.removeCondicion(req.user!.id_perfil!, idCondicion);
      noContent(res);
    } catch (error) {
      next(error);
    }
  },


  /**
   * POST /api/patient-profile/me/food-preferences
   * Agrega una preferencia alimenticia al perfil.
   */
  async addPreferencia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id_alimento, tipo } = req.body as AddPreferenciaDto;
      await patientProfileService.addPreferencia(req.user!.id_perfil!, id_alimento, tipo);
      ok(res, null, 'Preferencia alimenticia agregada');
    } catch (error) {
      next(error);
    }
  },


  /**
   * DELETE /api/patient-profile/me/food-preferences/:id
   * Elimina una preferencia alimenticia del perfil.
   */
  async removePreferencia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idPreferencia = parseInt(String(req.params.id), 10);
      await patientProfileService.removePreferencia(req.user!.id_perfil!, idPreferencia);
      noContent(res);
    } catch (error) {
      next(error);
    }
  },


  /**
   * POST /api/patient-profile/me/sports
   * Agrega un deporte de interés al perfil.
   */
  async addDeporte(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { deporte } = req.body as AddDeporteDto;
      await patientProfileService.addDeporte(req.user!.id_perfil!, deporte);
      ok(res, null, 'Deporte de interés agregado');
    } catch (error) {
      next(error);
    }
  },


  /**
   * DELETE /api/patient-profile/me/sports/:id
   * Elimina un deporte de interés del perfil.
   */
  async removeDeporte(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const idActividad = parseInt(String(req.params.id), 10);
      await patientProfileService.removeDeporte(req.user!.id_perfil!, idActividad);
      noContent(res);
    } catch (error) {
      next(error);
    }
  },

};