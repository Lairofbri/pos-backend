import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { obtenerOrdenShared } from '../../shared.js';
import { io } from '../../../../server.js';
import { fromCents, sumCents, toCents } from '../../../../shared/utils/money.js';

interface MetodoPago {
  metodo: string;
  monto: number;
  referencia?: string | null;
  banco?: string | null;
  hash?: string | null;
  wallet?: string | null;
  descripcion?: string | null;
}

const buildMontoParams = (metodo: MetodoPago): Record<string, number> => ({
  monto_efectivo: metodo.metodo === 'efectivo' ? metodo.monto : 0,
  monto_tarjeta: ['tarjeta', 'tarjeta_debito', 'tarjeta_credito', 'tarjeta_empresarial'].includes(metodo.metodo) ? metodo.monto : 0,
  monto_transferencia: metodo.metodo === 'transferencia' ? metodo.monto : 0,
  monto_bitcoin: metodo.metodo === 'bitcoin' ? metodo.monto : 0,
  monto_monedero: metodo.metodo === 'monedero_electronico' ? metodo.monto : 0,
  monto_cheque: metodo.metodo === 'cheque' ? metodo.monto : 0,
  monto_bonos: metodo.metodo === 'bonos' ? metodo.monto : 0,
  monto_vales: metodo.metodo === 'vales' ? metodo.monto : 0,
  monto_otro: metodo.metodo === 'otro' ? metodo.monto : 0,
});

export const registrarPago = async ({ tenantId, ordenId, usuarioId, datos }: { tenantId: string; ordenId: string; usuarioId: string; datos: { metodos: MetodoPago[] } }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  if (orden.estado === 'pagada') {
    throw { status: 409, mensaje: 'Esta orden ya fue pagada.' };
  }
  if (orden.estado === 'cancelada') {
    throw { status: 400, mensaje: 'No se puede pagar una orden cancelada.' };
  }

  const metodos = datos.metodos;
  const totalFiscalCents = toCents(orden.total || 0, 'total de la orden');
  const propinaCents = toCents(orden.propina_monto || 0, 'propina');
  const montoAPagarCents = totalFiscalCents + propinaCents;
  const totalPagadoCents = sumCents(metodos.map(m => m.monto), 'monto del pago');

  if (totalPagadoCents < montoAPagarCents) {
    throw {
      status: 400,
      mensaje: `El monto pagado ($${fromCents(totalPagadoCents).toFixed(2)}) es menor al total a pagar con propina ($${fromCents(montoAPagarCents).toFixed(2)}).`,
    };
  }

  const tieneEfectivo = metodos.some(m => m.metodo === 'efectivo');
  const excedenteCents = totalPagadoCents - montoAPagarCents;
  if (excedenteCents > 0 && !tieneEfectivo) {
    throw {
      status: 400,
      mensaje: 'No se permiten pagos superiores al total cuando no existe un pago en efectivo.',
    };
  }
  const vueltoCents = tieneEfectivo ? excedenteCents : 0;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const pagoRows: unknown[] = [];

    for (let i = 0; i < metodos.length; i++) {
      const metodo = metodos[i];
      const montos = buildMontoParams(metodo);
      const isCashRow = metodo.metodo === 'efectivo';
      const rowVuelto = isCashRow ? vueltoCents : 0;

      const { rows } = await client.query(
        `INSERT INTO pagos
           (orden_id, tenant_id, metodo,
            monto_efectivo, monto_tarjeta,
            monto_transferencia, monto_bitcoin, monto_monedero,
            monto_cheque, monto_tarjeta_empresarial,
            monto_bonos, monto_vales, monto_otro,
            total_pagado, vuelto,
            referencia_tarjeta, referencia_transferencia, banco_emisor,
            hash_bitcoin, wallet_id,
            referencia_cheque, descripcion_otro,
            usuario_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                 $16, $17, $18, $19, $20, $21, $22, $23)
         RETURNING id, metodo, monto_efectivo, monto_tarjeta, total_pagado, vuelto, creado_en`,
        [
          ordenId, tenantId, metodo.metodo,
          montos.monto_efectivo, montos.monto_tarjeta,
          montos.monto_transferencia,
          montos.monto_bitcoin,
          montos.monto_monedero,
          montos.monto_cheque,
          montos.monto_tarjeta_empresarial,
          montos.monto_bonos,
          montos.monto_vales,
          montos.monto_otro,
          fromCents(toCents(metodo.monto, 'monto del pago')), fromCents(rowVuelto),
          ['tarjeta', 'tarjeta_debito', 'tarjeta_credito', 'tarjeta_empresarial'].includes(metodo.metodo) ? (metodo.referencia || null) : null,
          metodo.metodo === 'transferencia' ? (metodo.referencia || null) : null,
          (metodo.metodo === 'transferencia' || metodo.metodo === 'cheque') ? (metodo.banco || null) : null,
          metodo.metodo === 'bitcoin' ? (metodo.hash || null) : null,
          (metodo.metodo === 'bitcoin' || metodo.metodo === 'monedero_electronico') ? (metodo.wallet || null) : null,
          metodo.metodo === 'cheque' ? (metodo.referencia || null) : null,
          metodo.metodo === 'otro' ? (metodo.descripcion || null) : null,
          usuarioId,
        ]
      );
      pagoRows.push(rows[0]);
    }

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

    const { rows: itemsAPagar } = await client.query(
       `SELECT oi.producto_id, SUM(oi.cantidad)::INTEGER AS cantidad, p.tiene_receta, p.tiene_stock, MAX(oi.receta_version) AS receta_version, MAX(oi.modificaciones::text)::jsonb AS modificaciones
       FROM orden_items oi
       JOIN productos p ON p.id = oi.producto_id AND p.tenant_id = $1
       WHERE oi.orden_id = $2
         AND oi.producto_id IS NOT NULL
         AND oi.estado <> 'cancelado'
         AND (p.tiene_receta = TRUE OR p.tiene_stock = TRUE)
       GROUP BY oi.producto_id, p.tiene_receta, p.tiene_stock`,
      [tenantId, ordenId]
    );

    for (const item of itemsAPagar as Array<{ producto_id: string; cantidad: number; tiene_receta: boolean; tiene_stock: boolean; receta_version: number | null; modificaciones: { sin?: string[]; extra?: Array<{ producto_id: string; cantidad: number; precio: number }> } | null }>) {
      const sinIds = (item.modificaciones?.sin || []) as string[];
      if (item.tiene_receta) {
        const { rows: ingredientes } = await client.query(
          `SELECT ri.ingrediente_id, ri.cantidad AS receta_cantidad,
                  ri.unidad_medida_id,
                  u.factor AS receta_factor,
                  r.rendimiento,
                  p.stock_actual, p.unidad_medida_id AS prod_um_id,
                  pu.factor AS prod_factor
           FROM receta_ingredientes ri
           JOIN recetas r ON r.id = ri.receta_id AND r.producto_id = $1
              ${item.receta_version ? 'AND r.version = $3' : 'AND r.vigente_hasta IS NULL'}
           JOIN productos p ON p.id = ri.ingrediente_id AND p.tenant_id = $2
           JOIN unidades_medida u ON u.id = ri.unidad_medida_id
           LEFT JOIN unidades_medida pu ON pu.id = p.unidad_medida_id`,
          [item.producto_id, tenantId, ...(item.receta_version ? [item.receta_version] : [])]
        );

        for (const ing of ingredientes as Array<{
          ingrediente_id: string;
          receta_cantidad: number;
          unidad_medida_id: string;
          receta_factor: number;
          rendimiento: number;
          stock_actual: number;
          prod_factor: number | null;
        }>) {
          if (sinIds.includes(ing.ingrediente_id)) continue;
          const recetaCantidad = Number(ing.receta_cantidad);
          const recetaFactor = Number(ing.receta_factor);
          const rendimiento = Number(ing.rendimiento) || 1;
          const prodFactor = Number(ing.prod_factor || 1);

          const qtyEnUnidadBase = recetaCantidad * recetaFactor;
          const qtyEnStockUnit = prodFactor > 0 ? qtyEnUnidadBase / prodFactor : qtyEnUnidadBase;
          const qtyAConsumir = Math.round((qtyEnStockUnit / rendimiento) * item.cantidad * 10000) / 10000;

          const stockAnterior = Math.round(Number(ing.stock_actual) * 10000) / 10000;
          const { rows: upd } = await client.query(
            `UPDATE productos SET stock_actual = stock_actual - $1
             WHERE id = $2 AND tenant_id = $3
             RETURNING stock_actual`,
            [qtyAConsumir, ing.ingrediente_id, tenantId]
          );
          const stockPosterior = Math.round(Number((upd[0] as { stock_actual: number }).stock_actual) * 10000) / 10000;

          await client.query(
            `INSERT INTO movimientos_inventario
               (tenant_id, sucursal_id, producto_id, tipo_movimiento, cantidad,
                stock_anterior, stock_posterior, referencia_tipo, referencia_id, creado_por,
                cantidad_input, unidad_input_id, unidad_medida_id)
             VALUES ($1, $2, $3, 'consumo', $4, $5, $6, 'orden', $7, $8, $4, $9, $10)`,
            [tenantId, null, ing.ingrediente_id, qtyAConsumir, stockAnterior, stockPosterior, ordenId, usuarioId, ing.unidad_medida_id, ing.unidad_medida_id]
          );
        }

        for (const extra of (item.modificaciones?.extra || [])) {
          const extraCantidad = extra.cantidad || 1;
          const { rows: extProd } = await client.query(
            `UPDATE productos SET stock_actual = stock_actual - $1
             WHERE id = $2 AND tenant_id = $3
             RETURNING stock_actual`,
            [extraCantidad, extra.producto_id, tenantId]
          );
          const extStockPosterior = Math.round(Number((extProd[0] as { stock_actual: number }).stock_actual) * 10000) / 10000;
          const extStockAnterior = Math.round((extStockPosterior + extraCantidad) * 10000) / 10000;
          await client.query(
            `INSERT INTO movimientos_inventario
               (tenant_id, sucursal_id, producto_id, tipo_movimiento, cantidad,
                stock_anterior, stock_posterior, referencia_tipo, referencia_id, creado_por)
             VALUES ($1, $2, $3, 'consumo', $4, $5, $6, 'orden', $7, $8)`,
            [tenantId, null, extra.producto_id, extraCantidad, extStockAnterior, extStockPosterior, ordenId, usuarioId]
          );
        }
      } else if (item.tiene_stock) {
        const { rows: updated } = await client.query(
          `UPDATE productos SET stock_actual = stock_actual - $1
           WHERE id = $2 AND tenant_id = $3
           RETURNING stock_actual`,
          [item.cantidad, item.producto_id, tenantId]
        );

        const stockPosterior = Math.round((updated[0] as { stock_actual: number }).stock_actual * 10000) / 10000;
        const stockAnterior = Math.round((stockPosterior + item.cantidad) * 10000) / 10000;

        await client.query(
          `INSERT INTO movimientos_inventario
             (tenant_id, sucursal_id, producto_id, tipo_movimiento, cantidad,
              stock_anterior, stock_posterior, referencia_tipo, referencia_id, creado_por)
           VALUES ($1, $2, $3, 'consumo', $4, $5, $6, 'orden', $7, $8)`,
          [tenantId, null, item.producto_id, item.cantidad, stockAnterior, stockPosterior, ordenId, usuarioId]
        );
      }
    }

    await client.query('COMMIT');

    if (orden.tipo !== 'rapido') {
      io.to(`tenant:${tenantId}`).emit('cocina:orden-completada', {
        orden_id: ordenId,
        numero_orden: orden.numero_orden,
      });
    }

    logger.info('Pago registrado', {
      orden_id: ordenId,
      metodos: metodos.map(m => m.metodo),
      total_pagado: fromCents(totalPagadoCents),
      vuelto: fromCents(vueltoCents),
    });

    return {
      pagos: pagoRows,
      orden: { ...orden, estado: 'pagada', total: orden.total },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
