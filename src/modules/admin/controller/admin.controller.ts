import { NextFunction, Request, Response } from 'express';
import { ok, created, paginated } from '@utils/response';
import {
  AdminActivityLogsQueryDto,
  AdminListUsersQueryDto,
  AdminResetPasswordDto,
  AdminUserIdParamDto,
  CreateNutritionistDto,
  UpdateAdminUserDto,
  UpdateAdminUserStatusDto,
  UpdateNutritionistInfoDto,
} from '../dto/admin.dto';
import { adminService } from '../service/admin.service';

export const adminController = {
  async listActivityLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = AdminActivityLogsQueryDto.safeParse(req.query);
      if (!parsed.success) {
        next(parsed.error);
        return;
      }

      const result = await adminService.listActivityLogs(parsed.data);
      paginated(res, result.items, {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
      });
    } catch (error) {
      next(error);
    }
  },

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
      created(
        res,
        result,
        'Nutricionista creada correctamente. Copia la contrasena temporal y compartela por un canal seguro.',
      );
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
      const result = await adminService.updateUser(paramsParsed.data.id, payload, {
        actor: req.user!,
        ip: req.ip,
      });
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
      const result = await adminService.updateUserStatus(
        req.user!.id,
        paramsParsed.data.id,
        payload.estado,
        {
          actor: req.user!,
          ip: req.ip,
        },
      );
      ok(res, result, 'Estado de cuenta actualizado correctamente');
    } catch (error) {
      next(error);
    }
  },

  async getNutritionistDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramsParsed = AdminUserIdParamDto.safeParse(req.params);
      if (!paramsParsed.success) {
        next(paramsParsed.error);
        return;
      }

      const result = await adminService.getNutritionistDetail(paramsParsed.data.id);
      ok(res, result);
    } catch (error) {
      next(error);
    }
  },

  async updateNutritionistInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramsParsed = AdminUserIdParamDto.safeParse(req.params);
      if (!paramsParsed.success) {
        next(paramsParsed.error);
        return;
      }

      const payload = req.body as UpdateNutritionistInfoDto;
      const result = await adminService.updateNutritionistInfo(paramsParsed.data.id, payload, {
        actor: req.user!,
        ip: req.ip,
      });
      ok(res, result, 'Nutricionista actualizada correctamente');
    } catch (error) {
      next(error);
    }
  },

  async updateNutritionistFull(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paramsParsed = AdminUserIdParamDto.safeParse(req.params);
      if (!paramsParsed.success) {
        next(paramsParsed.error);
        return;
      }

      const payload = req.body as UpdateAdminUserDto;
      const result = await adminService.updateNutritionistFull(paramsParsed.data.id, payload, {
        actor: req.user!,
        ip: req.ip,
      });
      ok(res, result, 'Nutricionista actualizada correctamente');
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
        {
          actor: req.user!,
          ip: req.ip,
        },
      );

      ok(res, result, 'Contrasena temporal generada. Copiala y compartela por un canal seguro.');
    } catch (error) {
      next(error);
    }
  },
};
