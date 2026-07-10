import type { Request, Response, NextFunction } from 'express';
import { query } from '../config/database.js';
import { error } from '../utils/response.js';

export const requiereCajaAbierta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rows } = await query(
      `SELECT id FROM cajas
       WHERE tenant_id = $1 AND estado = 'abierta'
       ORDER BY fecha_apertura DESC LIMIT 1`,
      [req.usuario!.tenant_id]
    );

    if (rows.length === 0) {
      return error(res, 'No hay una caja abierta. Abre la caja antes de realizar esta operación.', 403);
    }

    (req as unknown as Record<string, unknown>).caja_id = rows[0].id;
    next();
  } catch {
    return error(res, 'Error al verificar caja abierta.', 500);
  }
};
