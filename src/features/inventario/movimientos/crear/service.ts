import { query, getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';

export const crearMovimiento = async ({
  tenantId,
  usuarioId,
  sucursalId,
  datos,
}: {
  tenantId: string;
  usuarioId: string;
  sucursalId: string | null;
  datos: {
    producto_id: string;
    tipo: string;
    cantidad: number;
    unidad_medida_id?: string;
    motivo?: string;
  };
}) => {
  const { producto_id, tipo, cantidad, unidad_medida_id, motivo } = datos;

  let cantidadBase = cantidad;
  let cantidadInput: number | null = null;
  let unidadInputId: string | null = null;
  let unidadMedidaId: string | null = unidad_medida_id || null;

  if (unidad_medida_id) {
    const { rows: unidadRows } = await query(
      `SELECT u.factor AS input_factor, u.categoria AS input_categoria,
              p.unidad_medida_id AS prod_um_id,
              pu.factor AS prod_factor
       FROM unidades_medida u
       JOIN productos p ON p.id = $1 AND p.tenant_id = $2
       LEFT JOIN unidades_medida pu ON pu.id = p.unidad_medida_id
       WHERE u.id = $3`,
      [producto_id, tenantId, unidad_medida_id]
    );

    if (unidadRows.length > 0) {
      const conv = unidadRows[0] as { input_factor: number; input_categoria: string; prod_um_id: string | null; prod_factor: number | null };
      const inputFactor = Number(conv.input_factor);
      const prodFactor = Number(conv.prod_factor || 1);
      const qtyEnBase = cantidad * inputFactor;
      cantidadBase = prodFactor > 0 ? qtyEnBase / prodFactor : qtyEnBase;
      cantidadInput = cantidad;
      unidadInputId = unidad_medida_id;
      unidadMedidaId = conv.prod_um_id || unidad_medida_id;
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: productoRows } = await client.query(
      `SELECT id, tiene_stock, stock_actual
       FROM productos
       WHERE id = $1 AND tenant_id = $2
       FOR UPDATE`,
      [producto_id, tenantId]
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

    switch (tipo) {
      case 'compra':
      case 'devolucion':
        stockPosterior = stockAnterior + cantidadBase;
        break;
      case 'merma':
        stockPosterior = stockAnterior - cantidadBase;
        break;
      case 'ajuste':
        stockPosterior = cantidadBase;
        break;
      default:
        throw { status: 400, mensaje: `Tipo de movimiento no válido: ${tipo}` };
    }

    await client.query(
      `UPDATE productos SET stock_actual = $1
       WHERE id = $2 AND tenant_id = $3`,
      [stockPosterior, producto_id, tenantId]
    );

    const { rows: movRows } = await client.query(
      `INSERT INTO movimientos_inventario
         (tenant_id, sucursal_id, producto_id, tipo_movimiento, cantidad,
          stock_anterior, stock_posterior, motivo, creado_por,
          cantidad_input, unidad_input_id, unidad_medida_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, tipo_movimiento, cantidad, stock_anterior, stock_posterior, motivo, creado_en`,
      [tenantId, sucursalId, producto_id, tipo, cantidadBase, stockAnterior, stockPosterior, motivo || null, usuarioId,
       cantidadInput, unidadInputId, unidadMedidaId]
    );

    await client.query('COMMIT');

    logger.info('Movimiento de inventario registrado', {
      producto_id,
      tipo,
      cantidad: cantidadBase,
      cantidad_input: cantidadInput,
      stock_anterior: stockAnterior,
      stock_posterior: stockPosterior,
    });

    return movRows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
