import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { obtenerOrdenShared } from '../../shared.js';
import { io } from '../../../../server.js';

export const registrarPago = async ({ tenantId, ordenId, usuarioId, datos }: { tenantId: string; ordenId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  if (orden.estado === 'pagada') {
    throw { status: 409, mensaje: 'Esta orden ya fue pagada.' };
  }
  if (orden.estado === 'cancelada') {
    throw { status: 400, mensaje: 'No se puede pagar una orden cancelada.' };
  }

  const { metodo, monto_efectivo = 0, monto_tarjeta = 0, referencia_tarjeta } = datos as {
    metodo: string;
    monto_efectivo?: number;
    monto_tarjeta?: number;
    referencia_tarjeta?: string;
  };

  const totalOrden = Number(orden.total) || 0;
  const propina = Number(orden.propina_monto) || 0;
  const montoAPagar = Number((totalOrden + propina).toFixed(2));
  const totalPagado = Number((monto_efectivo + monto_tarjeta).toFixed(2));

  if (totalPagado < montoAPagar) {
    throw {
      status: 400,
      mensaje: `El monto pagado ($${totalPagado}) es menor al total a pagar con propina ($${montoAPagar}).`,
    };
  }

  const vuelto = Number((totalPagado - montoAPagar).toFixed(2));

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: pagoRows } = await client.query(
      `INSERT INTO pagos
         (orden_id, tenant_id, metodo, monto_efectivo, monto_tarjeta,
          total_pagado, vuelto, referencia_tarjeta, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, metodo, monto_efectivo, monto_tarjeta, total_pagado, vuelto, creado_en`,
      [
        ordenId, tenantId, metodo,
        monto_efectivo, monto_tarjeta,
        totalPagado, vuelto,
        referencia_tarjeta || null,
        usuarioId,
      ]
    );

    await client.query(
      'UPDATE ordenes SET estado = $1, cerrado_en = NOW() WHERE id = $2',
      ['pagada', ordenId]
    );

    if (orden.mesa_id) {
      await client.query(
        'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
        ['disponible', orden.mesa_id, tenantId]
      );
    }

    await client.query('COMMIT');

    io.to(`tenant:${tenantId}`).emit('cocina:orden-completada', {
      orden_id: ordenId,
      numero_orden: orden.numero_orden,
    });

    logger.info('Pago registrado', {
      orden_id: ordenId,
      metodo,
      total_pagado: totalPagado,
      vuelto,
    });

    return {
      pago: pagoRows[0],
      orden: { ...orden, estado: 'pagada', total: orden.total },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
