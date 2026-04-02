import { dishesRepository } from '../repository/dishes.repository';
import { CreateDishDto, UpdateDishDto, UpsertIngredientDto } from '../dto/dishes.dto';
import { NotFoundError, ConflictError } from '@errors/AppError';

export const dishesService = {

  async list(filters: {
    search?: string;
    activo?: string;
    page:    number;
    limit:   number;
  }) {
    const offset = (filters.page - 1) * filters.limit;
    const { rows, total } = await dishesRepository.findAll({ ...filters, offset });
    return {
      data: rows,
      meta: {
        page: filters.page, limit: filters.limit, total,
        total_pages: Math.ceil(total / filters.limit),
      },
    };
  },


  async getById(id: number) {
    const result = await dishesRepository.findByIdWithIngredients(id);
    if (!result) throw new NotFoundError('Plato');
    return result;
  },


  async create(data: CreateDishDto) {
    const exists = await dishesRepository.existsByName(data.nombre);
    if (exists) throw new ConflictError(`El plato '${data.nombre}' ya existe`);

    return dishesRepository.create({
      nombre:                 data.nombre,
      descripcion:            data.descripcion,
      modo_preparacion:       data.modo_preparacion,
      enlace_video:           data.enlace_video,
      tiempo_preparacion_min: data.tiempo_preparacion_min,
      ingredientes:           data.ingredientes ?? [],
    });
  },


  async update(id: number, data: UpdateDishDto) {
    const dish = await dishesRepository.findById(id);
    if (!dish) throw new NotFoundError('Plato');

    if (data.nombre) {
      const exists = await dishesRepository.existsByName(data.nombre, id);
      if (exists) throw new ConflictError(`El plato '${data.nombre}' ya existe`);
    }

    return dishesRepository.update(id, data);
  },


  async setStatus(id: number, activo: boolean) {
    const dish = await dishesRepository.findById(id);
    if (!dish) throw new NotFoundError('Plato');
    return dishesRepository.setStatus(id, activo);
  },


  async upsertIngredient(platoId: number, data: UpsertIngredientDto) {
    const dish = await dishesRepository.findById(platoId);
    if (!dish) throw new NotFoundError('Plato');
    await dishesRepository.upsertIngredient(platoId, data.id_alimento, data.cantidad_g);
    return dishesRepository.findByIdWithIngredients(platoId);
  },


  async removeIngredient(platoId: number, ingredienteId: number) {
    const dish = await dishesRepository.findById(platoId);
    if (!dish) throw new NotFoundError('Plato');
    await dishesRepository.removeIngredient(platoId, ingredienteId);
  },

};