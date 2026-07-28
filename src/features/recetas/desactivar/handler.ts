import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export const handler = async (req: Request, res: Response) => {
  const { query } = await import('../../../shared/config/database.js');

  try {
    const { rows } = await query(
      `SELECT r.id, r.producto_id, p.nombre
       FROM recetas r
       JOIN productos p ON p.id = r.producto_id AND p.tenant_id = $1
       WHERE r.id = $2`,
      [req.usuario!.tenant_id, req.params.id]
    );

    if (rows.length === 0) {
      return error(res, 'Receta no encontrada.', 404);
    }

    const receta = rows[0] as { producto_id: string; nombre: string };

    await query('DELETE FROM recetas WHERE id = $1', [req.params.id]);

    await query(
      'UPDATE productos SET tiene_receta = FALSE, activo = FALSE WHERE id = $1 AND tenant_id = $2',
      [receta.producto_id, req.usuario!.tenant_id]
    );

    logger.info('Receta eliminada', {
      receta_id: req.params.id,
      producto_id: receta.producto_id,
      producto: receta.nombre,
    });

    return exito(res, null, 'Receta eliminada exitosamente.');
  } catch (err) {
    logger.error('Error al eliminar receta', { error: (err as Error).message });
    return errorServidor(res);
  }
};
