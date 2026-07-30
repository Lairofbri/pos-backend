import { getClient } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';

export const desactivarReceta = async ({ tenantId, recetaId }: { tenantId: string; recetaId: string }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT r.id, r.producto_id, p.nombre
       FROM recetas r
       JOIN productos p ON p.id = r.producto_id AND p.tenant_id = $1
       WHERE r.id = $2`,
      [tenantId, recetaId]
    );

    if (rows.length === 0) {
      throw { status: 404, mensaje: 'Receta no encontrada.' };
    }

    const receta = rows[0] as { producto_id: string; nombre: string };

    await client.query('DELETE FROM recetas WHERE id = $1', [recetaId]);

    await client.query(
      'UPDATE productos SET tiene_receta = FALSE, activo = FALSE WHERE id = $1 AND tenant_id = $2',
      [receta.producto_id, tenantId]
    );

    await client.query('COMMIT');

    logger.info('Receta eliminada', {
      receta_id: recetaId,
      producto_id: receta.producto_id,
      producto: receta.nombre,
    });

    return { producto_nombre: receta.nombre };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
