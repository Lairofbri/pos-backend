import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { obtenerProducto } from '../obtener/service.js';

export const ajustarStock = async ({ tenantId, productoId, cantidad, tipo, motivo }: { tenantId: string; productoId: string; cantidad: number; tipo: string; motivo?: string }) => {
  const producto = await obtenerProducto({ tenantId, productoId }) as { tiene_stock: boolean; stock_actual: number };

  if (!producto.tiene_stock) {
    throw { status: 400, mensaje: 'Este producto no tiene control de inventario activado.' };
  }

  let nuevoStock: number;
  if (tipo === 'suma') nuevoStock = producto.stock_actual + cantidad;
  else if (tipo === 'resta') nuevoStock = producto.stock_actual - cantidad;
  else nuevoStock = cantidad;

  if (nuevoStock < 0) {
    throw { status: 400, mensaje: `Stock insuficiente. Stock actual: ${producto.stock_actual}.` };
  }

  const { rows } = await query(
    `UPDATE productos SET stock_actual = $1
     WHERE id = $2 AND tenant_id = $3
     RETURNING id, nombre, stock_actual, stock_minimo`,
    [nuevoStock, productoId, tenantId]
  );

  logger.info('Stock ajustado', {
    producto_id: productoId,
    tipo,
    cantidad,
    stock_anterior: producto.stock_actual,
    stock_nuevo: nuevoStock,
    motivo,
  });

  return rows[0];
};
