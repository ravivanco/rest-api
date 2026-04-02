import { exercisesRepository } from '../repository/exercises.repository';
import { CreateExerciseDto, UpdateExerciseDto } from '../dto/exercises.dto';
import { NotFoundError, ConflictError } from '@errors/AppError';

export const exercisesService = {

  async list(filters: {
    search?:                     string;
    intensidad?:                 string;
    nivel_actividad_recomendado?: string;
    categoria?:                  string;
    activo?:                     string;
    page:                        number;
    limit:                       number;
  }) {
    const offset = (filters.page - 1) * filters.limit;
    const { rows, total } = await exercisesRepository.findAll({ ...filters, offset });
    return {
      data: rows,
      meta: {
        page: filters.page, limit: filters.limit, total,
        total_pages: Math.ceil(total / filters.limit),
      },
    };
  },


  async getById(id: number) {
    const exercise = await exercisesRepository.findById(id);
    if (!exercise) throw new NotFoundError('Ejercicio');
    return exercise;
  },


  async create(data: CreateExerciseDto) {
    const exists = await exercisesRepository.existsByName(data.nombre);
    if (exists) throw new ConflictError(`El ejercicio '${data.nombre}' ya existe`);
    return exercisesRepository.create(data);
  },


  async update(id: number, data: UpdateExerciseDto) {
    const exercise = await exercisesRepository.findById(id);
    if (!exercise) throw new NotFoundError('Ejercicio');

    if (data.nombre) {
      const exists = await exercisesRepository.existsByName(data.nombre, id);
      if (exists) throw new ConflictError(`El ejercicio '${data.nombre}' ya existe`);
    }

    return exercisesRepository.update(id, data);
  },


  async setStatus(id: number, activo: boolean) {
    const exercise = await exercisesRepository.findById(id);
    if (!exercise) throw new NotFoundError('Ejercicio');
    return exercisesRepository.setStatus(id, activo);
  },

};