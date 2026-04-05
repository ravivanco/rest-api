import bcrypt         from 'bcryptjs';
import jwt            from 'jsonwebtoken';
import crypto         from 'crypto';
import { env }        from '@config/env';
import { authRepository } from '../repository/auth.repository';
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  BusinessRuleError,
} from '@errors/AppError';
import { RegisterDto, LoginDto } from '../dto/auth.dto';

/**
 * Genera un hash SHA-256 del refresh token.
 * Se usa para guardar el token en BD sin exponer el valor real.
 */
const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const isRefreshPayload = (
  payload: unknown,
): payload is { sub: number; type: string } => {
  if (!payload || typeof payload !== 'object') return false;

  const candidate = payload as Record<string, unknown>;

  return typeof candidate.sub === 'number' && typeof candidate.type === 'string';
};

/**
 * Calcula la fecha de expiración del refresh token (7 días).
 */
const getRefreshExpiry = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
};

/**
 * Service de autenticación.
 * Toda la lógica de negocio relacionada con auth vive aquí.
 */
export const authService = {

  /**
   * Registra un nuevo paciente.
   *
   * Reglas aplicadas:
   * - RN-01: El correo debe ser del dominio institucional
   * - Correo único: no puede estar ya registrado
   * - Contraseña hasheada con bcrypt (nunca se guarda en texto plano)
   */
  async register(data: RegisterDto) {

    // RN-01: Validar dominio institucional
    const domain = data.correo_institucional.split('@')[1];
    if (domain !== env.INSTITUTIONAL_DOMAIN) {
      throw new BusinessRuleError(
        `Solo se permiten correos del dominio @${env.INSTITUTIONAL_DOMAIN}`
      );
    }

    // Verificar que el correo no esté registrado
    const exists = await authRepository.existsByEmail(data.correo_institucional);
    if (exists) {
      throw new ConflictError(
        `El correo ${data.correo_institucional} ya está registrado`
      );
    }

    // Hashear la contraseña (bcrypt con 12 rounds ≈ 400ms por intento)
    const contrasenaHash = await bcrypt.hash(data.contrasena, env.BCRYPT_SALT_ROUNDS);

    // Crear usuario + perfil en una sola transacción
    const { usuario, perfil } = await authRepository.createUserWithProfile({
      correo:          data.correo_institucional,
      contrasenaHash,
      nombres:         data.nombres,
      apellidos:       data.apellidos,
      edad:            data.edad,
      sexo:            data.sexo,
      fechaNacimiento: data.fecha_nacimiento,
    });

    return {
      id_usuario:           usuario.id_usuario,
      correo_institucional: usuario.correo_institucional,
      nombres:              usuario.nombres,
      apellidos:            usuario.apellidos,
      rol:                  usuario.rol,
      formulario_completado: perfil.formulario_completado,
    };
  },


  /**
   * Inicia sesión y genera un par de tokens JWT.
   *
   * Seguridad implementada:
   * - Siempre ejecuta bcrypt.compare aunque el usuario no exista (anti timing attack)
   * - El mensaje de error nunca dice si el correo existe o no (anti enumeración)
   * - Verifica que la cuenta esté activa antes de emitir tokens
   */
  async login(data: LoginDto) {

    // Buscar usuario (puede ser null)
    const usuario = await authRepository.findByEmail(data.correo_institucional);

    // SIEMPRE comparar el hash aunque el usuario no exista
    // Esto hace que login con correo inexistente tome el mismo tiempo
    // que login con correo existente → previene timing attacks
    const hashParaComparar = usuario?.contrasena_hash ?? '$2b$12$invalidhashfortiming';
    const contrasenaValida = await bcrypt.compare(data.contrasena, hashParaComparar);

    // Mensaje genérico — nunca revela si el correo existe
    if (!usuario || !contrasenaValida) {
      throw new UnauthorizedError('Credenciales inválidas');
    }

    // Verificar que la cuenta no esté suspendida
    if (usuario.estado !== 'activo') {
      throw new ForbiddenError('Tu cuenta está suspendida o inactiva. Contacta al administrador.');
    }

    // Obtener id_perfil si es paciente (para incluirlo en el token)
    let id_perfil: number | null = null;
    let formulario_completado = false;
    let modulo_habilitado = false;

    if (usuario.rol === 'paciente') {
      const perfil = await authRepository.findPerfilByUserId(usuario.id_usuario);
      if (perfil) {
        id_perfil = perfil.id_perfil;
        formulario_completado = perfil.formulario_completado;
        // modulo_habilitado se consulta del plan activo en módulos posteriores
      }
    }

    // Generar access token (dura 15 minutos)
    const accessToken = jwt.sign(
      {
        sub:       usuario.id_usuario,
        email:     usuario.correo_institucional,
        role:      usuario.rol,
        id_perfil,
        estado:    usuario.estado,
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
        issuer:    'dk-fitt-api',
        audience:  'dk-fitt-clients',
      },
    );

    // Generar refresh token (dura 7 días)
    const refreshToken = jwt.sign(
      { sub: usuario.id_usuario, type: 'refresh' },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    // Guardar hash del refresh token en BD para poder revocarlo
    await authRepository.saveRefreshToken({
      userId:    usuario.id_usuario,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshExpiry(),
    });

    return {
      access_token:  accessToken,
      refresh_token: refreshToken,
      expires_in:    900,        // 15 minutos en segundos
      token_type:    'Bearer',
      user: {
        id_usuario:           usuario.id_usuario,
        nombres:              usuario.nombres,
        apellidos:            usuario.apellidos,
        correo_institucional: usuario.correo_institucional,
        rol:                  usuario.rol,
        formulario_completado,
        modulo_habilitado,
      },
    };
  },


  /**
   * Renueva el access token usando el refresh token.
   * Implementa rotación de tokens: el refresh usado se revoca
   * y se emite uno nuevo.
   */
  async refreshToken(token: string) {

    // Verificar la firma del refresh token
    let payload: { sub: number; type: string };
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);

      if (!isRefreshPayload(decoded)) {
        throw new UnauthorizedError('Token inválido');
      }

      payload = decoded;
    } catch {
      throw new UnauthorizedError('Refresh token inválido o expirado');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedError('Token inválido');
    }

    // Verificar que el token esté en BD y no esté revocado
    const tokenHash = hashToken(token);
    const tokenEnBD = await authRepository.findRefreshToken(tokenHash);

    if (!tokenEnBD) {
      // Si el token no existe pero tiene firma válida, alguien lo está reusando
      // Revocar TODOS los tokens del usuario como medida de seguridad
      await authRepository.revokeAllUserTokens(payload.sub);
      throw new UnauthorizedError(
        'Token de sesión inválido. Por seguridad, inicia sesión nuevamente.'
      );
    }

    // Obtener usuario actualizado de la BD
    const usuario = await authRepository.findById(payload.sub);
    if (!usuario || usuario.estado !== 'activo') {
      throw new UnauthorizedError('Usuario no encontrado o inactivo');
    }

    // Obtener id_perfil actualizado
    let id_perfil: number | null = null;
    if (usuario.rol === 'paciente') {
      const perfil = await authRepository.findPerfilByUserId(usuario.id_usuario);
      id_perfil = perfil?.id_perfil ?? null;
    }

    // Revocar el refresh token usado (rotación)
    await authRepository.revokeRefreshToken(tokenHash);

    // Emitir nuevo par de tokens
    const newAccessToken = jwt.sign(
      {
        sub:       usuario.id_usuario,
        email:     usuario.correo_institucional,
        role:      usuario.rol,
        id_perfil,
        estado:    usuario.estado,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    const newRefreshToken = jwt.sign(
      { sub: usuario.id_usuario, type: 'refresh' },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );

    await authRepository.saveRefreshToken({
      userId:    usuario.id_usuario,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: getRefreshExpiry(),
    });

    return {
      access_token:  newAccessToken,
      refresh_token: newRefreshToken,
      expires_in:    900,
      token_type:    'Bearer',
    };
  },


  /**
   * Cierra la sesión revocando el refresh token.
   * El access token expira solo (stateless — no se puede revocar).
   */
  async logout(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await authRepository.revokeRefreshToken(tokenHash);
    // No lanza error si el token no existe — el resultado es el mismo
  },


  /**
   * Cambia la contraseña del usuario autenticado.
   * Revoca todos los refresh tokens para forzar re-login en todos los dispositivos.
   */
  async changePassword(userId: number, contrasenaActual: string, contrasenaNueva: string) {

    const usuario = await authRepository.findById(userId);
    if (!usuario) throw new UnauthorizedError();

    // Verificar que la contraseña actual sea correcta
    const esValida = await bcrypt.compare(contrasenaActual, usuario.contrasena_hash);
    if (!esValida) {
      throw new UnauthorizedError('La contraseña actual es incorrecta');
    }

    // Hashear la nueva contraseña
    const nuevoHash = await bcrypt.hash(contrasenaNueva, env.BCRYPT_SALT_ROUNDS);
    await authRepository.updatePassword(userId, nuevoHash);

    // Revocar todos los tokens activos (forzar re-login en todos los dispositivos)
    await authRepository.revokeAllUserTokens(userId);
  },

};