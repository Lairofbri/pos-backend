import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { ESTADOS_FINALES } from '../../../../shared/utils/constants.js';
import { obtenerOrdenShared, validarTransicion } from '../../shared.js';
import { io } from '../../../../server.js';

export const cambiarEstadoOrden = async ({ tenantId, ordenId, estado, motivo, usuarioId }: { tenantId: string; ordenId: string; estado: string; motivo?: string; usuarioId: string }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  validarTransicion(orden.estado as string, estado);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const cerradoEn = ESTADOS_FINALES.includes(estado) ? 'NOW()' : 'NULL';

    await client.query(
      `UPDATE ordenes SET estado = $1, cerrado_en = ${cerradoEn} WHERE id = $2 AND tenant_id = $3`,
      [estado, ordenId, tenantId]
    );

    let itemsEnviados: Array<Record<string, unknown>> = [];
    if (estado === 'en_proceso') {
      const { rows } = await client.query(
        `UPDATE orden_items SET estado = 'en_proceso', enviado_en = NOW(), enviado_por = $1
         WHERE orden_id = $2 AND tenant_id = $3 AND estado = 'pendiente'
         RETURNING id, producto_id, nombre_producto, cantidad, notas`,
        [usuarioId, ordenId, tenantId]
      );
      itemsEnviados = rows as Array<Record<string, unknown>>;
    }

    if (estado === 'cancelada' && orden.mesa_id) {
      await client.query(
        'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
        ['disponible', orden.mesa_id, tenantId]
      );
    }

    await client.query('COMMIT');

    if (estado === 'en_proceso' && itemsEnviados.length > 0) {
      const sala = `tenant:${tenantId}`;
      for (const item of itemsEnviados) {
        io.to(sala).emit('cocina:nuevo-item', {
          item_id: item.id,
          orden_id: ordenId,
          nombre_producto: item.nombre_producto,
          cantidad: item.cantidad,
          notas: item.notas,
        });
      }
    }

    if (estado === 'pagada') {
      io.to(`tenant:${tenantId}`).emit('cocina:orden-completada', {
        orden_id: ordenId,
        numero_orden: orden.numero_orden,
      });
    }

    logger.info('Estado de orden cambiado', {
      orden_id: ordenId,
      estado_anterior: orden.estado as string,
      estado_nuevo: estado,
      motivo,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
