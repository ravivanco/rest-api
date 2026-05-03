import { pool } from '@database/pool';
import { ConflictError, NotFoundError, ValidationError } from '@errors/AppError';
import type { PoolClient } from 'pg';
import {
  GET_INGREDIENTES_MENU,
  GET_MENU_DIARIO_BY_ID,
  GET_MENU_REPLACE_CONTEXT,
  GET_PENDING_SUGGESTION_FOR_MENU,
  GET_PLATO_REPLACE_CONTEXT,
  INSERT_HISTORIAL_CAMBIO,
  UPDATE_MENU_PLATO,
} from '../menus-diarios.queries';
import { ReplaceMenuPlatoResult, MenuDiarioDetailResult } from '../dto/update-plato.dto';
import { UPDATE_SUGERENCIA_ESTADO } from '../../sugerencias/sugerencias.queries';

interface MenuDetailRow {
  id_menu_diario: number;
  dia_semana: string;
  fecha: string;
  tiempo_comida: string;
  id_plato: number;
  nombre: string;
  descripcion: string | null;
  calorias_totales: number;
  tiempo_preparacion_min: number | null;
  modo_preparacion: string;
  generado_por_ia: boolean;
  calorias_aportadas: number;
}

interface IngredienteMenuRow {
  nombre: string;
  cantidad_g: number;
  calorias_aportadas: number;
}

interface MenuReplaceContextRow {
  id_menu_diario: number;
  id_dia_plan: number;
  id_tiempo_comida: number;
  id_plato_anterior: number;
  calorias_anteriores: number;
  estado_plan: string;
  id_perfil: number;
}

interface PlatoReplaceContextRow {
  id_plato: number;
  nombre: string;
  calorias_totales: number;
  tiempo_preparacion_min: number | null;
  id_tiempo_comida: number | null;
  activo: boolean;
}

interface PendingSuggestionRow {
  id_sugerencia: number;
  motivo: string;
}

const CLIENT_STATES_ALLOWED = ['activo', 'pendiente'] as const;

type QueryClient = PoolClient;

const isManagedClient = (client: QueryClient): boolean => {
  return typeof (client as { release?: unknown }).release === 'function';
};

const mapMenuDetail = (menu: MenuDetailRow, ingredientes: IngredienteMenuRow[]): MenuDiarioDetailResult => {
  return {
    id_menu_diario: menu.id_menu_diario,
    dia_semana: menu.dia_semana,
    fecha: menu.fecha,
    tiempo_comida: menu.tiempo_comida,
    plato: {
      id_plato: menu.id_plato,
      nombre: menu.nombre,
      descripcion: menu.descripcion,
      calorias_totales: Number(menu.calorias_totales),
      tiempo_preparacion_min: menu.tiempo_preparacion_min,
      modo_preparacion: menu.modo_preparacion,
      generado_por_ia: menu.generado_por_ia,
      ingredientes: ingredientes.map(ingrediente => ({
        nombre: ingrediente.nombre,
        cantidad_g: Number(ingrediente.cantidad_g),
        calorias_aportadas: Number(ingrediente.calorias_aportadas),
      })),
    },
    calorias_aportadas: Number(menu.calorias_aportadas),
  };
};

export const menusDiariosService = {
  async getMenuById(menuId: number): Promise<MenuDiarioDetailResult> {
    const menuResult = await pool.query<MenuDetailRow>(GET_MENU_DIARIO_BY_ID, [menuId]);
    const menu = menuResult.rows[0];

    if (!menu) {
      throw new NotFoundError('Menú diario');
    }

    const ingredientesResult = await pool.query<IngredienteMenuRow>(GET_INGREDIENTES_MENU, [menu.id_plato]);

    return mapMenuDetail(menu, ingredientesResult.rows);
  },

  async replacePlato(
    menuId: number,
    idPlatoNuevo: number,
    idUsuarioAccion: number,
    motivo: string,
    options?: {
      client?: PoolClient;
      skipPendingSuggestionAutoApproval?: boolean;
    },
  ): Promise<ReplaceMenuPlatoResult> {
    const client = options?.client ?? await pool.connect();
    const ownsTransaction = !options?.client;

    try {
      if (ownsTransaction) {
        await client.query('BEGIN');
      }

      const menuResult = await client.query<MenuReplaceContextRow>(GET_MENU_REPLACE_CONTEXT, [menuId]);
      const menu = menuResult.rows[0];

      if (!menu) {
        throw new NotFoundError('Menú diario');
      }

      if (!CLIENT_STATES_ALLOWED.includes(menu.estado_plan as (typeof CLIENT_STATES_ALLOWED)[number])) {
        throw new ConflictError(`No se puede modificar un plan en estado '${menu.estado_plan}'`);
      }

      const platoResult = await client.query<PlatoReplaceContextRow>(GET_PLATO_REPLACE_CONTEXT, [idPlatoNuevo]);
      const plato = platoResult.rows[0];

      if (!plato || !plato.activo) {
        throw new NotFoundError('Plato');
      }

      if (plato.id_tiempo_comida === null || plato.id_tiempo_comida !== menu.id_tiempo_comida) {
        throw new ValidationError('El plato nuevo no coincide con el tiempo de comida del menú');
      }

      const updateResult = await client.query<{ id_menu_diario: number; id_plato: number; calorias_aportadas: number }>(
        UPDATE_MENU_PLATO,
        [menuId, idPlatoNuevo, Number(plato.calorias_totales)],
      );

      await client.query(INSERT_HISTORIAL_CAMBIO, [
        menuId,
        menu.id_plato_anterior,
        idPlatoNuevo,
        motivo,
        idUsuarioAccion,
      ]);

      if (!options?.skipPendingSuggestionAutoApproval) {
        const pendingSuggestionResult = await client.query<PendingSuggestionRow>(GET_PENDING_SUGGESTION_FOR_MENU, [menuId]);
        const pendingSuggestion = pendingSuggestionResult.rows[0];

        if (pendingSuggestion) {
          await client.query(UPDATE_SUGERENCIA_ESTADO, [
            pendingSuggestion.id_sugerencia,
            'aprobada',
            idUsuarioAccion,
          ]);
        }
      }

      const result: ReplaceMenuPlatoResult = {
        id_menu_diario: updateResult.rows[0].id_menu_diario,
        id_plato_anterior: menu.id_plato_anterior,
        id_plato_nuevo: updateResult.rows[0].id_plato,
        calorias_anteriores: Number(menu.calorias_anteriores),
        calorias_nuevas: Number(updateResult.rows[0].calorias_aportadas),
        nombre_plato_nuevo: plato.nombre,
      };

      if (ownsTransaction) {
        await client.query('COMMIT');
      }

      return result;
    } catch (error) {
      if (ownsTransaction) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (ownsTransaction && isManagedClient(client)) {
        client.release();
      }
    }
  },
};
