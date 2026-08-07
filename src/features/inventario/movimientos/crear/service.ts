import { query, getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { incrementarStock, fijarStock, descontarStock, convertirCantidad } from '../../stock-service.js';

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
    costo_unitario?: number;
  };
}) => {
  const { producto_id, tipo, cantidad, unidad_medida_id, motivo, costo_unitario } = datos;

  const { cantidadBase, cantidadInput, unidadInputId, unidadMedidaId } = await convertirCantidad({
    productoId: producto_id,
    tenantId,
    cantidad,
    unidadMedidaId: unidad_medida_id,
  });

  if (tipo === 'consumo') {
    throw { status: 400, mensaje: 'No se puede crear un movimiento de tipo consumo manualmente. El consumo se genera automáticamente al pagar.' };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let result: { stockAnterior: number; stockPosterior: number; movimientoId: string };

    switch (tipo) {
      case 'compra':
      case 'devolucion':
        result = await incrementarStock({
          tenantId, productoId: producto_id, cantidad: cantidadBase,
          sucursalId, usuarioId, tipoMovimiento: tipo, motivo,
          client,
        });
        break;
      case 'merma':
        result = await descontarStock({
          tenantId, productoId: producto_id, cantidad: cantidadBase,
          sucursalId, usuarioId, motivo,
          client,
        });
        break;
      case 'ajuste':
        result = await fijarStock({
          tenantId, productoId: producto_id, nuevoStock: cantidadBase,
          sucursalId, usuarioId, motivo,
          client,
        });
        break;
      default:
        throw { status: 400, mensaje: `Tipo de movimiento no válido: ${tipo}` };
    }

    if (costo_unitario) {
      await client.query(
        'UPDATE movimientos_inventario SET costo_unitario = $1 WHERE id = $2',
        [costo_unitario, result.movimientoId]
      );
    }

    if (tipo === 'compra' && costo_unitario && costo_unitario > 0) {
      const { rows: [producto] } = await client.query(
        'SELECT costo_promedio FROM productos WHERE id = $1 AND tenant_id = $2',
        [producto_id, tenantId]
      );
      const costoAnterior = parseFloat(producto.costo_promedio);
      const stockAntes = result.stockAnterior;

      let nuevoPromedio: number;
      if (stockAntes <= 0) {
        nuevoPromedio = costo_unitario;
      } else {
        nuevoPromedio = ((stockAntes * costoAnterior) + (cantidadBase * costo_unitario))
          / (stockAntes + cantidadBase);
      }

      await client.query(
        'UPDATE productos SET costo_promedio = $1 WHERE id = $2',
        [Math.round(nuevoPromedio * 100) / 100, producto_id]
      );
    }

    if (unidadInputId || unidadMedidaId) {
      await client.query(
        'UPDATE movimientos_inventario SET cantidad_input = $1, unidad_input_id = $2, unidad_medida_id = $3 WHERE id = $4',
        [cantidadInput, unidadInputId, unidadMedidaId, result.movimientoId]
      );
    }

    await client.query('COMMIT');

    logger.info('Movimiento de inventario registrado', {
      producto_id,
      tipo,
      cantidad: cantidadBase,
      cantidad_input: cantidadInput,
      stock_anterior: result.stockAnterior,
      stock_posterior: result.stockPosterior,
    });

    return {
      id: result.movimientoId,
      tipo_movimiento: tipo,
      cantidad: cantidadBase,
      stock_anterior: result.stockAnterior,
      stock_posterior: result.stockPosterior,
      cantidad_input: cantidadInput,
      creado_en: new Date().toISOString(),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
