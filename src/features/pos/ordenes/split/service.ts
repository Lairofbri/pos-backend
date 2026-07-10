import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { ESTADOS_FINALES } from '../../../../shared/utils/constants.js';
import { obtenerOrdenShared, recalcularOrden, moveItemsBetweenOrders } from '../../shared.js';

export const splitOrden = async ({ tenantId, usuarioId, ordenId, datos }: { tenantId: string; usuarioId: string; ordenId: string; datos: Record<string, unknown> }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(orden.estado as string)) {
    throw { status: 400, mensaje: `No se puede dividir una orden "${orden.estado}".` };
  }

  const items = (orden as { items: Array<unknown> }).items;
  if (items.length <= 1) {
    throw { status: 400, mensaje: 'La orden debe tener al menos 2 items para dividir.' };
  }

  const { items: itemIds, tipo, mesa_id, notas } = datos as {
    items: string[];
    tipo?: string;
    mesa_id?: string;
    notas?: string;
  };

  await moveItemsBetweenOrders({ tenantId, ordenOrigenId: ordenId, items: itemIds });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: ordenRows } = await client.query(
      `INSERT INTO ordenes
         (tenant_id, tipo, mesa_id, usuario_id, notas)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tipo, estado, numero_orden, creado_en`,
      [tenantId, tipo || 'rapido', mesa_id || null, usuarioId, notas || null]
    );

    const nuevaOrdenId = (ordenRows[0] as Record<string, unknown>).id as string;

    await client.query(
      'UPDATE orden_items SET orden_id = $1 WHERE id = ANY($2::uuid[]) AND tenant_id = $3',
      [nuevaOrdenId, itemIds, tenantId]
    );

    const totalesOrigen = await recalcularOrden(client, ordenId, tenantId);
    const totalesDestino = await recalcularOrden(client, nuevaOrdenId, tenantId);

    await client.query('COMMIT');

    logger.info('Orden dividida', {
      orden_origen: ordenId,
      nueva_orden: nuevaOrdenId,
      items_movidos: itemIds.length,
    });

    return {
      orden_original: { id: ordenId, ...totalesOrigen },
      nueva_orden: { id: nuevaOrdenId, ...(ordenRows[0] as Record<string, unknown>), ...totalesDestino },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
