import { Request, Response, NextFunction } from 'express';
import { pool } from '@database/pool';
import { GET_APTITUDES_CLINICAS } from '../aptitudes-clinicas.queries';

interface AptitudClinicaRow {
  id_aptitud: number;
  codigo: string;
  nombre: string;
}

export const aptitudesClinicasController = {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await pool.query<AptitudClinicaRow>(GET_APTITUDES_CLINICAS);
      res.status(200).json(result.rows);
    } catch (error) {
      next(error);
    }
  },
};
