import { dishesRepository } from '../repository/dishes.repository';
import { CreateDishDto, UpdateDishDto, UpsertIngredientDto } from '../dto/dishes.dto';
import { NotFoundError, ConflictError } from '@errors/AppError';

export const dishesService = {

  async list(filters: {
    search?: string;
    activo?: string;
    page: number;
    limit: number;
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
    
    const stepsText = result.plato.modo_preparacion;

    const platoConAliases = {
      ...result.plato,
      nombre_plato:      result.plato.nombre,
      calorias:          result.plato.calorias_totales,
      descripcion_plato: result.plato.descripcion,
      receta:            result.plato.descripcion,
      pasos_preparacion: stepsText,
      preparation:       stepsText,
      preparacion:       stepsText,
      instructions:      stepsText,
      steps:             stepsText,
    };

    const mappedIngredients = result.ingredientes.map(i => ({
      ...i,
      nombre_alimento: i.nombre,
      gramos:          i.cantidad_g,
      calorias:        i.calorias,
    }));

    return {
      // Nested format (para compatibilidad con Web/Dashboard anterior)
      plato:        platoConAliases,
      ingredientes: mappedIngredients,
      aptitudes:    result.aptitudes,

      // Flat format (para compatibilidad con el mapeo directo de la App Móvil)
      ...platoConAliases,
      ingredients:  mappedIngredients,
      alimentos:    mappedIngredients,
      insumos:      mappedIngredients,

      // Preparación flat a nivel raíz
      pasos_preparacion: stepsText,
      preparation:       stepsText,
      preparacion:       stepsText,
      instructions:      stepsText,
      steps:             stepsText,
    };
  },


  async create(data: CreateDishDto) {
    const exists = await dishesRepository.existsByName(data.nombre);
    if (exists) throw new ConflictError(`El plato '${data.nombre}' ya existe`);

    return dishesRepository.create({
      nombre: data.nombre,
      descripcion: data.descripcion,
      modo_preparacion: data.modo_preparacion,
      enlace_video: data.enlace_video,
      tiempo_preparacion_min: data.tiempo_preparacion_min,
      id_tiempo_comida: data.id_tiempo_comida, 
      ingredientes: data.ingredientes ?? [],
      aptitudes: data.aptitudes ?? [],
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


  async remove(id: number): Promise<void> {
    const deleted = await dishesRepository.delete(id);
    if (!deleted) throw new NotFoundError('Plato');
  },


  async forceRemove(id: number): Promise<{
    id_plato: number;
    menus_afectados: number;
    planes_afectados: number;
    accion: 'desvinculado_y_eliminado';
  }> {
    const dish = await dishesRepository.findById(id);
    if (!dish) throw new NotFoundError('Plato');

    const result = await dishesRepository.forceDelete(id);
    if (!result.deleted) throw new NotFoundError('Plato');

    return {
      id_plato: id,
      menus_afectados: result.menusAfectados,
      planes_afectados: result.planesAfectados,
      accion: 'desvinculado_y_eliminado',
    };
  },

};