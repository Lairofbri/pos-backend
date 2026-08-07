import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { incrementarStock, descontarStock } from '../../stock-service.js';

export const revertirMovimiento = async ({
  tenantId,
  usuarioId,
  movimientoId,
}: {
  tenantId: string;
  usuarioId: string;
  movimientoId: string;
}) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, producto_id, tipo_movimiento, cantidad,
              sucursal_id
       FROM movimientos_inventario
       WHERE id = $1 AND tenant_id = $2
       FOR UPDATE`,
      [movimientoId, tenantId]
    );

    if (rows.length === 0) {
      throw { status: 404, mensaje: 'Movimiento no encontrado.' };
    }

    const mov = rows[0] as {
      id: string;
      producto_id: string;
      tipo_movimiento: string;
      cantidad: number;
      sucursal_id: string | null;
    };

    const tiposReversibles = ['compra', 'devolucion', 'merma'];
    if (!tiposReversibles.includes(mov.tipo_movimiento)) {
      throw { status: 400, mensaje: `No se puede revertir un movimiento de tipo "${mov.tipo_movimiento}". Solo compra, devolución y merma son reversibles.` };
    }

    const { rows: yaRevertido } = await client.query(
      `SELECT id FROM movimientos_inventario
       WHERE movimiento_revertido_id = $1`,
      [movimientoId]
    );

    if (yaRevertido.length > 0) {
      throw { status: 409, mensaje: 'Este movimiento ya fue revertido.' };
    }

    let result: { movimientoId: string };
    const motivo = `Reversión de movimiento ${movimientoId.slice(0, 8)}...`;

    switch (mov.tipo_movimiento) {
      case 'compra':
      case 'devolucion':
        result = await descontarStock({
          tenantId,
          productoId: mov.producto_id,
          cantidad: mov.cantidad,
          sucursalId: mov.sucursal_id,
          usuarioId,
          motivo,
          client,
        });
        break;
      case 'merma':
        result = await incrementarStock({
          tenantId,
          productoId: mov.producto_id,
          cantidad: mov.cantidad,
          sucursalId: mov.sucursal_id,
          usuarioId,
          tipoMovimiento: 'devolucion',
          motivo,
          client,
        });
        break;
      default:
        throw { status: 400, mensaje: `Tipo no reversible: ${mov.tipo_movimiento}` };
    }

    await client.query(
      `UPDATE movimientos_inventario
       SET movimiento_revertido_id = $1, revertido_en = NOW()
       WHERE id = $2`,
      [result.movimientoId, movimientoId]
    );

    await client.query('COMMIT');

    logger.info('Movimiento revertido', {
      movimiento_original_id: movimientoId,
      movimiento_reversion_id: result.movimientoId,
      tipo_original: mov.tipo_movimiento,
      producto_id: mov.producto_id,
      cantidad: mov.cantidad,
    });

    return {
      mensaje: `Movimiento de tipo "${mov.tipo_movimiento}" revertido exitosamente.`,
      movimiento_original_id: movimientoId,
      movimiento_reversion_id: result.movimientoId,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
