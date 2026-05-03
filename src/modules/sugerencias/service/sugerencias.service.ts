import { pool } from '@database/pool';
import { ConflictError, NotFoundError } from '@errors/AppError';
import type { PoolClient } from 'pg';
import { menusDiariosService } from '../../menus-diarios/service/menus-diarios.service';
import {
  GET_SUGERENCIAS_PENDIENTES,
  GET_SUGERENCIA_BY_ID,
  REJECT_OTHER_PENDING_SUGERENCIAS,
  UPDATE_SUGERENCIA_ESTADO,
} from '../sugerencias.queries';
import {
  SuggestionFiltersDto,
  SuggestionListItem,
  SuggestionReviewResult,
} from '../dto/sugerencia.dto';

interface SuggestionListRow {
  id_sugerencia: number;
  motivo: string;
  estado: string;
  created_at: string;
  id_menu_diario: number;
  fecha: string;
  tiempo_comida: string;
  id_plato_actual: number;
  nombre_plato_actual: string;
  calorias_plato_actual: number;
  id_plato_sugerido: number;
  nombre_plato_sugerido: string;
  calorias_plato_sugerido: number;
}

interface SuggestionRow {
  id_sugerencia: number;
  id_menu_diario: number;
  id_plato_sugerido: number;
  motivo: string;
  estado: string;
  id_nutricionista_revisor: number | null;
  fecha_revision: string | null;
  created_at: string;
  id_plato_actual: number;
  id_tiempo_comida: number;
  id_dia_plan: number;
  estado_plan: string;
  id_perfil: number;
  nombre_plato_sugerido: string;
  calorias_plato_sugerido: number;
}

const mapSuggestionList = (row: SuggestionListRow): SuggestionListItem => ({
  id_sugerencia: row.id_sugerencia,
  motivo: row.motivo,
  estado: row.estado,
  created_at: row.created_at,
  menu_actual: {
    id_menu_diario: row.id_menu_diario,
    fecha: row.fecha,
    tiempo_comida: row.tiempo_comida,
    plato_actual: {
      id_plato: row.id_plato_actual,
      nombre: row.nombre_plato_actual,
      calorias_totales: Number(row.calorias_plato_actual),
    },
  },
  plato_sugerido: {
    id_plato: row.id_plato_sugerido,
    nombre: row.nombre_plato_sugerido,
    calorias_totales: Number(row.calorias_plato_sugerido),
  },
});

type QueryClient = PoolClient;

export const sugerenciasService = {
  async list(filters: SuggestionFiltersDto): Promise<{ sugerencias: SuggestionListItem[] }> {
    const result = await pool.query<SuggestionListRow>(GET_SUGERENCIAS_PENDIENTES, [
      filters.estado ?? 'pendiente',
      filters.id_perfil ?? null,
      filters.id_plan ?? null,
    ]);

    return {
      sugerencias: result.rows.map(mapSuggestionList),
    };
  },

  async review(
    suggestionId: number,
    accion: 'aprobar' | 'rechazar',
    reviewerUserId: number,
  ): Promise<SuggestionReviewResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const suggestionResult = await client.query<SuggestionRow>(GET_SUGERENCIA_BY_ID, [suggestionId]);
      const suggestion = suggestionResult.rows[0];

      if (!suggestion) {
        throw new NotFoundError('Sugerencia');
      }

      if (suggestion.estado !== 'pendiente') {
        throw new ConflictError('La sugerencia ya fue revisada');
      }

      let replacement: SuggestionReviewResult['replacement'];

      if (accion === 'aprobar') {
        replacement = await menusDiariosService.replacePlato(
          suggestion.id_menu_diario,
          suggestion.id_plato_sugerido,
          reviewerUserId,
          suggestion.motivo,
          {
            client: client as QueryClient,
            skipPendingSuggestionAutoApproval: true,
          },
        );
      }

      await client.query(UPDATE_SUGERENCIA_ESTADO, [
        suggestion.id_sugerencia,
        accion === 'aprobar' ? 'aprobada' : 'rechazada',
        reviewerUserId,
      ]);

      await client.query(REJECT_OTHER_PENDING_SUGERENCIAS, [
        suggestion.id_menu_diario,
        reviewerUserId,
        suggestion.id_sugerencia,
      ]);

      await client.query('COMMIT');

      return {
        id_sugerencia: suggestion.id_sugerencia,
        estado: accion === 'aprobar' ? 'aprobada' : 'rechazada',
        id_menu_diario: suggestion.id_menu_diario,
        ...(replacement ? { replacement } : {}),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};
