import {
  CreateAlimentoDetalleDto,
  UpdateAlimentoDetalleDto,
} from '../dto/alimentos-detalle.dto';
import {
  alimentosDetalleRepository,
} from '../repository/alimentos-detalle.repository';
import { NotFoundError } from '@errors/AppError';

export const alimentosDetalleService = {
  async list(filters: {
    search?: string;
    categoria?: string;
    page: number;
    limit: number;
  }) {
    const offset = (filters.page - 1) * filters.limit;

    const { rows, total } = await alimentosDetalleRepository.findAll({
      search: filters.search,
      categoria: filters.categoria,
      limit: filters.limit,
      offset,
    });

    return {
      data: rows,
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        total_pages: Math.ceil(total / filters.limit),
      },
    };
  },

  async getById(id: number) {
    const alimento = await alimentosDetalleRepository.findById(id);

    if (!alimento) {
      throw new NotFoundError('Alimento detalle');
    }

    return alimento;
  },

  async create(data: CreateAlimentoDetalleDto) {
    return alimentosDetalleRepository.create(data);
  },

  async update(id: number, data: UpdateAlimentoDetalleDto) {
    const existing = await alimentosDetalleRepository.findById(id);

    if (!existing) {
      throw new NotFoundError('Alimento detalle');
    }

    return alimentosDetalleRepository.update(id, data);
  },

  async remove(id: number): Promise<void> {
    const deleted = await alimentosDetalleRepository.delete(id);

    if (!deleted) {
      throw new NotFoundError('Alimento detalle');
    }
  },
};
