import { NextFunction, Request, Response } from 'express';
import { ok, created } from '@utils/response';
import {
  AdminListUsersQueryDto,
  AdminResetPasswordDto,
  AdminUserIdParamDto,
  CreateNutritionistDto,
  UpdateAdminUserDto,
  UpdateAdminUserStatusDto,
} from '../dto/admin.dto';
import { adminService } from '../service/admin.service';

export const adminController = {
  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = AdminListUsersQueryDto.safeParse(req.query);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }

      const result = await adminService.listUsers(parsed.data);
      ok(res, result);
    } catch (error) {
      next(error);
    }
  },

  async createNutritionist(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as CreateNutritionistDto;
      const result = await adminService.createNutritionist(payload);
      created(res, result, 'Nutricionista creada correctamente');
    } catch (error) {
      next(error);
    }
  },

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramsParsed = AdminUserIdParamDto.safeParse(req.params);
      if (!paramsParsed.success) {
        next(paramsParsed.error);
        return;
      }

      const payload = req.body as UpdateAdminUserDto;
      const result = await adminService.updateUser(paramsParsed.data.id, payload);
      ok(res, result, 'Usuario actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },

  async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramsParsed = AdminUserIdParamDto.safeParse(req.params);
      if (!paramsParsed.success) {
        next(paramsParsed.error);
        return;
      }

      const payload = req.body as UpdateAdminUserStatusDto;
      const result = await adminService.updateUserStatus(req.user!.id, paramsParsed.data.id, payload.estado);
      ok(res, result, 'Estado de cuenta actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramsParsed = AdminUserIdParamDto.safeParse(req.params);
      if (!paramsParsed.success) {
        next(paramsParsed.error);
        return;
      }

      const payload = (req.body ?? {}) as AdminResetPasswordDto;
      const result = await adminService.resetUserPassword(
        paramsParsed.data.id,
        payload.contrasena_temporal,
      );

      ok(res, result);
    } catch (error) {
      next(error);
    }
  },
};
