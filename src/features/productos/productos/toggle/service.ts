import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { obtenerProducto } from '../obtener/service.js';

export const toggleProducto = async ({ tenantId, productoId }: { tenantId: string; productoId: string }) => {
  const producto = await obtenerProducto({ tenantId, productoId }) as { activo: boolean };
  const nuevoEstado = !producto.activo;

  await query(
    'UPDATE productos SET activo = $1 WHERE id = $2 AND tenant_id = $3',
    [nuevoEstado, productoId, tenantId]
  );

  logger.info('Producto toggled', { producto_id: productoId, activo: nuevoEstado });
  return { activo: nuevoEstado };
};
