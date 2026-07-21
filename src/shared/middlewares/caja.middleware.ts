import type { Request, Response, NextFunction } from 'express';
import { query } from '../config/database.js';
import { error } from '../utils/response.js';

export const requiereCajaAbierta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const valores: unknown[] = [req.usuario!.tenant_id];
    let idx = 2;
    let sucursalCondicion = '';
    if (req.sucursalId) {
      sucursalCondicion = ` AND sucursal_id = $${idx++}`;
      valores.push(req.sucursalId);
    }
    const { rows } = await query(
      `SELECT id FROM cajas
       WHERE tenant_id = $1 AND estado = 'abierta'
         ${sucursalCondicion}
       ORDER BY fecha_apertura DESC LIMIT 1`,
      valores
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
