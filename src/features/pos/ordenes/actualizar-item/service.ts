import { query, getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { ESTADOS_FINALES } from '../../../../shared/utils/constants.js';
import { obtenerOrdenShared, recalcularOrden } from '../../shared.js';
import { io } from '../../../../server.js';

export const actualizarItem = async ({ tenantId, ordenId, itemId, usuarioId, datos }: { tenantId: string; ordenId: string; itemId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(orden.estado as string)) {
    throw { status: 400, mensaje: `No se pueden modificar items de una orden "${orden.estado}".` };
  }

  const { rows: itemRows } = await query(
    'SELECT * FROM orden_items WHERE id = $1 AND orden_id = $2 AND tenant_id = $3',
    [itemId, ordenId, tenantId]
  );

  if ((itemRows as Array<Record<string, unknown>>).length === 0) throw { status: 404, mensaje: 'Item no encontrado.' };
  const itemActual = (itemRows as Array<Record<string, unknown>>)[0];

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const campos: string[] = [];
    const valores: unknown[] = [];
    let idx = 1;

    const d = datos as { cantidad?: number; notas?: string; estado?: string; descuento_porcentaje?: number };

    if (d.cantidad !== undefined && d.cantidad !== itemActual.cantidad) {
      const diferencia = d.cantidad - (itemActual.cantidad as number);
      const nuevoSubtotal = Number(((itemActual.precio_unitario as number) * d.cantidad).toFixed(2));

      campos.push(`cantidad = $${idx++}`, `subtotal = $${idx++}`);
      valores.push(d.cantidad, nuevoSubtotal);

      const { rows: prodRows } = await client.query(
        'SELECT tiene_stock, stock_actual FROM productos WHERE id = $1 AND tenant_id = $2',
        [itemActual.producto_id, tenantId]
      );

      const prod = (prodRows as Array<{ tiene_stock?: boolean; stock_actual?: number }>)[0];
      if (prod?.tiene_stock) {
        if (diferencia > 0 && (prod.stock_actual as number) < diferencia) {
          throw {
            status: 400,
            mensaje: `Stock insuficiente. Stock actual: ${prod.stock_actual}.`,
          };
        }
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND tenant_id = $3',
          [diferencia, itemActual.producto_id, tenantId]
        );
      }
    }

    if (d.notas !== undefined) { campos.push(`notas = $${idx++}`); valores.push(d.notas); }
    if (d.estado !== undefined) {
      campos.push(`estado = $${idx++}`);
      valores.push(d.estado);
      if (d.estado === 'en_proceso' && itemActual.estado !== 'en_proceso') {
        campos.push(`enviado_en = $${idx++}`, `enviado_por = $${idx++}`);
        valores.push(new Date(), usuarioId);
      }
    }
    if (d.descuento_porcentaje !== undefined) { campos.push(`descuento_porcentaje = $${idx++}`); valores.push(d.descuento_porcentaje); }

    if (campos.length > 0) {
      valores.push(itemId, tenantId);
      await client.query(
        `UPDATE orden_items SET ${campos.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}`,
        valores
      );
    }

    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');

    if (d.estado) {
      const sala = `tenant:${tenantId}`;
      if (d.estado === 'en_proceso' && itemActual.estado !== 'en_proceso') {
        io.to(sala).emit('cocina:nuevo-item', {
          item_id: itemId,
          orden_id: ordenId,
          nombre_producto: itemActual.nombre_producto,
          cantidad: d.cantidad || itemActual.cantidad,
          notas: d.notas || itemActual.notas,
        });
      }
      if (d.estado === 'listo' && itemActual.estado !== 'listo') {
        io.to(sala).emit('cocina:item-listo', {
          item_id: itemId,
          orden_id: ordenId,
          nombre_producto: itemActual.nombre_producto,
        });
      }
    }

    logger.info('Item actualizado', { item_id: itemId, orden_id: ordenId });
    return totales;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
