import { foodsRepository } from '../repository/foods.repository';
import { CreateFoodDto, UpdateFoodDto } from '../dto/foods.dto';
import { NotFoundError, ConflictError } from '@errors/AppError';

export const foodsService = {

  async list(filters: {
    search?:    string;
    categoria?: string;
    activo?:    string;
    page:       number;
    limit:      number;
  }) {
    const offset = (filters.page - 1) * filters.limit;
    const { rows, total } = await foodsRepository.findAll({ ...filters, offset });
    return {
      data: rows,
      meta: {
        page: filters.page, limit: filters.limit, total,
        total_pages: Math.ceil(total / filters.limit),
      },
    };
  },


  async getById(id: number) {
    const food = await foodsRepository.findById(id);
    if (!food) throw new NotFoundError('Alimento');
    return food;
  },


  async create(data: CreateFoodDto) {
    // Verificar nombre único
    const exists = await foodsRepository.existsByName(data.nombre);
    if (exists) throw new ConflictError(`El alimento '${data.nombre}' ya existe`);

    return foodsRepository.create(data);
  },


  async update(id: number, data: UpdateFoodDto) {
    const food = await foodsRepository.findById(id);
    if (!food) throw new NotFoundError('Alimento');

    if (data.nombre) {
      const exists = await foodsRepository.existsByName(data.nombre, id);
      if (exists) throw new ConflictError(`El alimento '${data.nombre}' ya existe`);
    }

    return foodsRepository.update(id, data);
  },


  async setStatus(id: number, activo: boolean) {
    const food = await foodsRepository.findById(id);
    if (!food) throw new NotFoundError('Alimento');
    return foodsRepository.setStatus(id, activo);
  },

};