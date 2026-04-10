import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { env } from '@config/env';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '@errors/AppError';
import { adminRepository } from '../repository/admin.repository';
import {
  AdminListUsersQueryDto,
  CreateNutritionistDto,
  UpdateAdminUserDto,
} from '../dto/admin.dto';

const generateTemporaryPassword = (length = 12): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*()_+-=';
  const all = upper + lower + numbers + symbols;

  const seed = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    numbers[randomInt(numbers.length)],
    symbols[randomInt(symbols.length)],
  ];

  while (seed.length < length) {
    seed.push(all[randomInt(all.length)]);
  }

  for (let i = seed.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [seed[i], seed[j]] = [seed[j], seed[i]];
  }

  return seed.join('');
};

export const adminService = {
  async listUsers(filters: AdminListUsersQueryDto) {
    const page = filters.page;
    const limit = filters.limit;
    const offset = (page - 1) * limit;

    const { items, total } = await adminRepository.listUsers({
      role: filters.role,
      status: filters.status,
      search: filters.search,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      limit,
      offset,
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async createNutritionist(data: CreateNutritionistDto) {
    const emailExists = await adminRepository.existsEmail(data.correo_institucional);
    if (emailExists) {
      throw new ConflictError(`El correo ${data.correo_institucional} ya está registrado`);
    }

    const registryExists = await adminRepository.existsNutritionistRegistry(
      data.perfil_nutricionista.numero_registro_profesional,
    );

    if (registryExists) {
      throw new ConflictError(
        `El registro profesional ${data.perfil_nutricionista.numero_registro_profesional} ya está registrado`,
      );
    }

    const contrasenaHash = await bcrypt.hash(data.contrasena_temporal, env.BCRYPT_SALT_ROUNDS);

    const created = await adminRepository.createNutritionistWithProfile({
      correo_institucional: data.correo_institucional,
      contrasena_hash: contrasenaHash,
      nombres: data.nombres,
      apellidos: data.apellidos,
      edad: data.edad,
      sexo: data.sexo,
      fecha_nacimiento: data.fecha_nacimiento,
      perfil_nutricionista: {
        numero_registro_profesional: data.perfil_nutricionista.numero_registro_profesional,
        especialidad: data.perfil_nutricionista.especialidad,
        telefono_contacto: data.perfil_nutricionista.telefono_contacto,
        foto_perfil_url: data.perfil_nutricionista.foto_perfil_url,
        horario_atencion: data.perfil_nutricionista.horario_atencion,
      },
    });

    return {
      id_usuario: created.user.id_usuario,
      correo_institucional: created.user.correo_institucional,
      nombres: created.user.nombres,
      apellidos: created.user.apellidos,
      edad: created.user.edad,
      sexo: created.user.sexo,
      fecha_nacimiento: created.user.fecha_nacimiento,
      rol: created.user.rol,
      estado: created.user.estado,
      fecha_registro: created.user.fecha_registro,
      perfil_nutricionista: created.nutritionistProfile,
    };
  },

  async updateUser(idUsuario: number, payload: UpdateAdminUserDto) {
    const existing = await adminRepository.findUserById(idUsuario);
    if (!existing) {
      throw new NotFoundError('Usuario');
    }

    if (
      payload.correo_institucional &&
      payload.correo_institucional !== existing.correo_institucional
    ) {
      const emailInUse = await adminRepository.existsEmail(payload.correo_institucional, idUsuario);
      if (emailInUse) {
        throw new ConflictError(`El correo ${payload.correo_institucional} ya está en uso`);
      }
    }

    if (payload.perfil_nutricionista) {
      if (existing.rol !== 'nutricionista') {
        throw new BusinessRuleError(
          'Solo los usuarios con rol nutricionista pueden actualizar perfil_nutricionista',
        );
      }

      const nutritionistProfile = await adminRepository.findNutritionistProfileByUserId(idUsuario);
      if (!nutritionistProfile) {
        throw new NotFoundError('Perfil de nutricionista');
      }

      if (
        payload.perfil_nutricionista.numero_registro_profesional &&
        payload.perfil_nutricionista.numero_registro_profesional !==
          nutritionistProfile.numero_registro_profesional
      ) {
        const registryInUse = await adminRepository.existsNutritionistRegistry(
          payload.perfil_nutricionista.numero_registro_profesional,
          idUsuario,
        );

        if (registryInUse) {
          throw new ConflictError(
            `El registro profesional ${payload.perfil_nutricionista.numero_registro_profesional} ya está en uso`,
          );
        }
      }
    }

    await adminRepository.updateUserAndProfile({
      id_usuario: idUsuario,
      userFields: {
        nombres: payload.nombres,
        apellidos: payload.apellidos,
        correo_institucional: payload.correo_institucional,
        edad: payload.edad,
        sexo: payload.sexo,
        fecha_nacimiento: payload.fecha_nacimiento,
      },
      nutritionistProfileFields: payload.perfil_nutricionista
        ? {
          numero_registro_profesional: payload.perfil_nutricionista.numero_registro_profesional,
          especialidad: payload.perfil_nutricionista.especialidad,
          telefono_contacto: payload.perfil_nutricionista.telefono_contacto,
          foto_perfil_url: payload.perfil_nutricionista.foto_perfil_url,
          horario_atencion: payload.perfil_nutricionista.horario_atencion,
        }
        : undefined,
    });

    const updated = await adminRepository.findAdminUserDetailById(idUsuario);
    if (!updated) {
      throw new NotFoundError('Usuario');
    }

    return updated;
  },

  async updateUserStatus(adminId: number, idUsuario: number, estado: 'activo' | 'inactivo' | 'suspendido') {
    const existing = await adminRepository.findUserById(idUsuario);

    if (!existing) {
      throw new NotFoundError('Usuario');
    }

    if (adminId === idUsuario && estado !== 'activo') {
      throw new BusinessRuleError('No puedes desactivar o suspender tu propia cuenta');
    }

    await adminRepository.updateUserStatus(idUsuario, estado);

    const updated = await adminRepository.findAdminUserDetailById(idUsuario);
    if (!updated) {
      throw new NotFoundError('Usuario');
    }

    return updated;
  },

  async resetUserPassword(idUsuario: number, providedPassword?: string) {
    const existing = await adminRepository.findUserById(idUsuario);

    if (!existing) {
      throw new NotFoundError('Usuario');
    }

    const temporaryPassword = providedPassword ?? generateTemporaryPassword(12);
    const contrasenaHash = await bcrypt.hash(temporaryPassword, env.BCRYPT_SALT_ROUNDS);

    await adminRepository.updatePasswordAndRevokeTokens({
      id_usuario: idUsuario,
      contrasena_hash: contrasenaHash,
    });

    return {
      id_usuario: idUsuario,
      temporary_password: temporaryPassword,
      message: 'Contraseña reseteada e invalidación de sesiones completada.',
    };
  },
};
