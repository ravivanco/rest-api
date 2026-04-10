import { patientProfileRepository } from '../repository/patient-profile.repository';
import { foodsRepository } from '../../foods/repository/foods.repository';
import { SaveProfileFormDto }        from '../dto/patient-profile.dto';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  BusinessRuleError,
} from '@errors/AppError';

interface PgErrorLike {
  code?: string;
}

const isPgError = (error: unknown): error is PgErrorLike => {
  return typeof error === 'object' && error !== null && 'code' in error;
};

export const patientProfileService = {

  /**
   * Catálogo consolidado para onboarding móvil.
   * Incluye condiciones médicas y alimentos activos con IDs.
   */
  async getOnboardingOptions() {
    const [condiciones, alimentosResult] = await Promise.all([
      patientProfileRepository.findCatalogoCondiciones(),
      foodsRepository.findAll({ limit: 500, offset: 0, activo: 'true' }),
    ]);

    return {
      condiciones,
      alimentos: alimentosResult.rows.map(a => ({
        id_alimento: a.id_alimento,
        nombre: a.nombre,
        categoria: a.categoria,
      })),
      activity_levels: ['sedentario', 'bajo', 'medio', 'alto'],
      objetivos: [
        'Reducir mi peso corporal',
        'Ganar masa muscular',
        'Mejorar mis hábitos alimenticios',
      ],
      deportes: [
        'gimnasio',
        'running',
        'caminata',
        'ciclismo',
        'futbol',
        'basquet',
        'natacion',
        'entrenamiento_casa',
        'otro',
        'ninguno',
      ],
    };
  },

  /**
   * Obtiene el formulario completo del paciente con todas sus relaciones.
   * Incluye condiciones, preferencias y deportes.
   */
  async getFullProfile(perfilId: number) {
    const perfil = await patientProfileRepository.findByPerfilId(perfilId);

    if (!perfil) {
      throw new NotFoundError('Perfil del paciente');
    }

    // Obtener todas las relaciones en paralelo (más eficiente)
    const [condiciones, preferencias, deportes] = await Promise.all([
      patientProfileRepository.findCondiciones(perfilId),
      patientProfileRepository.findPreferencias(perfilId),
      patientProfileRepository.findDeportes(perfilId),
    ]);

    return {
      ...perfil,
      condiciones,
      alimentos_preferidos:   preferencias.filter(p => p.tipo === 'preferido'),
      alimentos_restringidos: preferencias.filter(p => p.tipo === 'restringido'),
      deportes,
    };
  },


  /**
   * Obtiene el formulario del paciente buscando por id_usuario.
   * Usado por la nutricionista para ver el perfil de un paciente.
   */
  async getProfileByUserId(userId: number) {
    const perfil = await patientProfileRepository.findByUserId(userId);

    if (!perfil) {
      throw new NotFoundError('Perfil del paciente');
    }

    const [condiciones, preferencias, deportes] = await Promise.all([
      patientProfileRepository.findCondiciones(perfil.id_perfil),
      patientProfileRepository.findPreferencias(perfil.id_perfil),
      patientProfileRepository.findDeportes(perfil.id_perfil),
    ]);

    return {
      ...perfil,
      condiciones,
      alimentos_preferidos:   preferencias.filter(p => p.tipo === 'preferido'),
      alimentos_restringidos: preferencias.filter(p => p.tipo === 'restringido'),
      deportes,
    };
  },


  /**
   * Guarda el formulario completo del paciente.
   * Al guardar todos los campos requeridos, marca formulario_completado = true.
   */
  async saveFullForm(perfilId: number, data: SaveProfileFormDto) {
    if (!Number.isInteger(perfilId) || perfilId <= 0) {
      throw new ValidationError('id_perfil inválido para guardar el formulario');
    }

    const perfil = await patientProfileRepository.findByPerfilId(perfilId);
    if (!perfil) {
      throw new NotFoundError('Perfil del paciente');
    }

    try {
      await patientProfileRepository.saveFullForm(perfilId, {
        nivel_actividad_fisica:     data.nivel_actividad_fisica,
        objetivo:                   data.objetivo,
        alergias_intolerancias:     data.alergias_intolerancias ?? null,
        restricciones_alimenticias: data.restricciones_alimenticias ?? null,
        condiciones:                data.condiciones,
        alimentos_preferidos:       data.alimentos_preferidos,
        alimentos_restringidos:     data.alimentos_restringidos,
        deportes:                   data.deportes,
      });
    } catch (error) {
      if (isPgError(error) && error.code === '23503') {
        throw new ValidationError('Uno o más IDs enviados no existen en los catálogos');
      }

      if (isPgError(error) && error.code === '23514') {
        throw new ValidationError('Uno de los valores enviados no cumple las restricciones permitidas');
      }

      if (isPgError(error) && error.code === '22P02') {
        throw new ValidationError('Formato de datos inválido en uno o más campos del formulario');
      }

      if (isPgError(error) && error.code === '23505') {
        throw new BusinessRuleError('Ya existe un registro igual en el perfil enviado');
      }

      throw error;
    }

    // Retornar el perfil actualizado.
    // Si falla la hidratacion de relaciones, no bloquear el onboarding:
    // el guardado ya fue exitoso en la transaccion anterior.
    try {
      return await this.getFullProfile(perfilId);
    } catch (error) {
      const perfilBase = await patientProfileRepository.findByPerfilId(perfilId);

      if (perfilBase) {
        return {
          ...perfilBase,
          condiciones: [],
          alimentos_preferidos: [],
          alimentos_restringidos: [],
          deportes: [],
        };
      }

      throw error;
    }
  },


  /**
   * Obtiene el catálogo de condiciones médicas disponibles.
   */
  async getCatalogoCondiciones() {
    return patientProfileRepository.findCatalogoCondiciones();
  },


  /**
   * Agrega una condición médica al perfil del paciente.
   */
  async addCondicion(perfilId: number, idCondicion: number) {
    // Verificar que el perfil existe
    const perfil = await patientProfileRepository.findByPerfilId(perfilId);
    if (!perfil) throw new NotFoundError('Perfil del paciente');

    await patientProfileRepository.addCondicion(perfilId, idCondicion);
  },


  /**
   * Elimina una condición médica del perfil.
   */
  async removeCondicion(perfilId: number, idCondicion: number) {
    await patientProfileRepository.removeCondicion(perfilId, idCondicion);
  },


  /**
   * Agrega una preferencia alimenticia al perfil.
   */
  async addPreferencia(perfilId: number, idAlimento: number, tipo: string) {
    const perfil = await patientProfileRepository.findByPerfilId(perfilId);
    if (!perfil) throw new NotFoundError('Perfil del paciente');

    await patientProfileRepository.addPreferencia(perfilId, idAlimento, tipo);
  },


  /**
   * Elimina una preferencia alimenticia del perfil.
   */
  async removePreferencia(perfilId: number, idPreferencia: number) {
    await patientProfileRepository.removePreferencia(perfilId, idPreferencia);
  },


  /**
   * Agrega un deporte de interés al perfil.
   */
  async addDeporte(perfilId: number, deporte: string) {
    const perfil = await patientProfileRepository.findByPerfilId(perfilId);
    if (!perfil) throw new NotFoundError('Perfil del paciente');

    await patientProfileRepository.addDeporte(perfilId, deporte);
  },


  /**
   * Elimina un deporte de interés del perfil.
   */
  async removeDeporte(perfilId: number, idActividad: number) {
    await patientProfileRepository.removeDeporte(perfilId, idActividad);
  },


  /**
   * Verifica que el paciente autenticado sea el dueño del perfil.
   * La nutricionista puede ver cualquier perfil sin restricción.
   */
  verifyOwnership(
    perfilId:    number,
    currentUser: { role: string; id_perfil: number | null }
  ): void {
    if (currentUser.role === 'nutricionista' || currentUser.role === 'administrador') {
      return;
    }
    if (currentUser.id_perfil !== perfilId) {
      throw new ForbiddenError('Solo puedes modificar tu propio perfil');
    }
  },

};