import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { ESTADOS_FINALES } from '../../../../shared/utils/constants.js';
import { obtenerOrdenShared, recalcularOrden, moveItemsBetweenOrders } from '../../shared.js';

export const transferirItems = async ({ tenantId, ordenId, datos }: { tenantId: string; ordenId: string; datos: Record<string, unknown> }) => {
  const ordenOrigen = await obtenerOrdenShared({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(ordenOrigen.estado as string)) {
    throw { status: 400, mensaje: `No se puede transferir desde una orden "${ordenOrigen.estado}".` };
  }

  const { items: itemIds, orden_destino_id } = datos as { items: string[]; orden_destino_id: string };

  const ordenDestino = await obtenerOrdenShared({ tenantId, ordenId: orden_destino_id });

  if (ESTADOS_FINALES.includes(ordenDestino.estado as string)) {
    throw { status: 400, mensaje: `No se puede transferir a una orden "${ordenDestino.estado}".` };
  }

  await moveItemsBetweenOrders({ tenantId, ordenOrigenId: ordenId, items: itemIds });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE orden_items SET orden_id = $1 WHERE id = ANY($2::uuid[]) AND tenant_id = $3',
      [orden_destino_id, itemIds, tenantId]
    );

    const totalesOrigen = await recalcularOrden(client, ordenId, tenantId);
    const totalesDestino = await recalcularOrden(client, orden_destino_id, tenantId);

    await client.query('COMMIT');

    logger.info('Items transferidos', {
      orden_origen: ordenId,
      orden_destino: orden_destino_id,
      items_movidos: itemIds.length,
    });

    return {
      orden_origen: { id: ordenId, ...totalesOrigen },
      orden_destino: { id: orden_destino_id, ...totalesDestino },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
