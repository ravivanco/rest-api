import { Request, Response, NextFunction } from 'express';
import { pool } from '@database/pool';
import { GET_TIEMPOS_COMIDA } from '../tiempos-comida.queries';

interface TiempoComidaRow {
  id_tiempo_comida: number;
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  orden: number;
}

export const tiemposComidaController = {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await pool.query<TiempoComidaRow>(GET_TIEMPOS_COMIDA);
      res.status(200).json(result.rows);
    } catch (error) {
      next(error);
    }
  },
};
