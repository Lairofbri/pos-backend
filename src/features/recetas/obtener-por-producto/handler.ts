import type { Request, Response } from 'express';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerReceta } from '../obtener/service.js';

export const handler = async (req: Request, res: Response) => {
  const { exito, error, errorServidor } = await import('../../../shared/utils/response.js');

  try {
    const { rows } = await (await import('../../../shared/config/database.js')).query(
      'SELECT id FROM recetas WHERE producto_id = $1 AND tenant_id = $2',
      [req.params.productoId, req.usuario!.tenant_id]
    );
    if (rows.length === 0) {
      return error(res, 'Este producto no tiene una receta asociada.', 404);
    }
    const receta = await obtenerReceta({
      tenantId: req.usuario!.tenant_id,
      recetaId: (rows[0] as { id: string }).id,
    });
    return exito(res, receta);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) {
      const { error } = await import('../../../shared/utils/response.js');
      return error(res, e.mensaje, e.status);
    }
    logger.error('Error al obtener receta por producto', { error: (err as Error).message });
    return errorServidor(res);
  }
};
