import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';

export const ajustarStock = async ({ tenantId, productoId, cantidad, tipo, motivo }: { tenantId: string; productoId: string; cantidad: number; tipo: string; motivo?: string }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: productoRows } = await client.query(
      `SELECT id, tiene_stock, stock_actual
       FROM productos
       WHERE id = $1 AND tenant_id = $2
       FOR UPDATE`,
      [productoId, tenantId]
    );

    if (productoRows.length === 0) {
      throw { status: 404, mensaje: 'Producto no encontrado.' };
    }

    const producto = productoRows[0] as { id: string; tiene_stock: boolean; stock_actual: number };

    if (!producto.tiene_stock) {
      throw { status: 400, mensaje: 'Este producto no tiene control de inventario activado.' };
    }

    const stockAnterior = producto.stock_actual;
    let stockPosterior: number;

    if (tipo === 'suma') stockPosterior = stockAnterior + cantidad;
    else if (tipo === 'resta') stockPosterior = stockAnterior - cantidad;
    else stockPosterior = cantidad;

    const { rows: updated } = await client.query(
      `UPDATE productos SET stock_actual = $1
       WHERE id = $2 AND tenant_id = $3
       RETURNING id, nombre, stock_actual, stock_minimo`,
      [stockPosterior, productoId, tenantId]
    );

    await client.query(
      `INSERT INTO movimientos_inventario
         (tenant_id, producto_id, tipo_movimiento, cantidad,
          stock_anterior, stock_posterior, motivo, creado_por)
       VALUES ($1, $2, 'ajuste', $3, $4, $5, $6, $7)`,
      [tenantId, productoId, cantidad, stockAnterior, stockPosterior, motivo || null, null]
    );

    await client.query('COMMIT');

    logger.info('Stock ajustado', {
      producto_id: productoId,
      tipo,
      cantidad,
      stock_anterior: stockAnterior,
      stock_nuevo: stockPosterior,
      motivo,
    });

    return updated[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
