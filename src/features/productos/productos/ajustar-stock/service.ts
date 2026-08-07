import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { incrementarStock, fijarStock, descontarStock } from '../../../../features/inventario/stock-service.js';

export const ajustarStock = async ({ tenantId, productoId, cantidad, tipo, motivo, creadoPor }: { tenantId: string; productoId: string; cantidad: number; tipo: string; motivo?: string; creadoPor?: string }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    let result: { stockAnterior: number; stockPosterior: number };

    if (tipo === 'suma') {
      result = await incrementarStock({
        tenantId, productoId, cantidad,
        sucursalId: null, usuarioId: creadoPor || 'sistema',
        motivo, client,
      });
    } else if (tipo === 'resta') {
      result = await descontarStock({
        tenantId, productoId, cantidad,
        sucursalId: null, usuarioId: creadoPor || 'sistema',
        motivo, client,
      });
    } else {
      result = await fijarStock({
        tenantId, productoId, nuevoStock: cantidad,
        sucursalId: null, usuarioId: creadoPor || 'sistema',
        motivo, client,
      });
    }

    await client.query('COMMIT');

    logger.info('Stock ajustado', {
      producto_id: productoId,
      tipo,
      cantidad,
      stock_anterior: result.stockAnterior,
      stock_nuevo: result.stockPosterior,
      motivo,
    });

    return { id: productoId, nombre: '', stock_actual: result.stockPosterior, stock_minimo: 0 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
