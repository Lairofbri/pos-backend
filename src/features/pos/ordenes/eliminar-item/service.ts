import { query, getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { ESTADOS_FINALES } from '../../../../shared/utils/constants.js';
import { obtenerOrdenShared, recalcularOrden } from '../../shared.js';

export const eliminarItem = async ({ tenantId, ordenId, itemId }: { tenantId: string; ordenId: string; itemId: string }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(orden.estado as string)) {
    throw { status: 400, mensaje: `No se pueden eliminar items de una orden "${orden.estado}".` };
  }

  const { rows: itemRows } = await query(
    'SELECT * FROM orden_items WHERE id = $1 AND orden_id = $2 AND tenant_id = $3',
    [itemId, ordenId, tenantId]
  );

  if ((itemRows as Array<Record<string, unknown>>).length === 0) throw { status: 404, mensaje: 'Item no encontrado.' };
  const item = (itemRows as Array<Record<string, unknown>>)[0];

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE orden_items SET estado = $1 WHERE id = $2 AND tenant_id = $3',
      ['cancelado', itemId, tenantId]
    );

    if (item.producto_id) {
      const { rows: prodRows } = await client.query(
        'SELECT tiene_stock FROM productos WHERE id = $1 AND tenant_id = $2',
        [item.producto_id, tenantId]
      );
      const prod = (prodRows as Array<{ tiene_stock?: boolean }>)[0];
      if (prod?.tiene_stock) {
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2 AND tenant_id = $3',
          [item.cantidad, item.producto_id, tenantId]
        );
      }
    }

    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');
    logger.info('Item eliminado de orden', { item_id: itemId, orden_id: ordenId });
    return totales;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
