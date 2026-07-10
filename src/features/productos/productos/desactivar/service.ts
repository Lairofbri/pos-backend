import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { obtenerProducto } from '../obtener/service.js';

export const desactivarProducto = async ({ tenantId, productoId }: { tenantId: string; productoId: string }) => {
  await obtenerProducto({ tenantId, productoId });

  await query(
    'UPDATE productos SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [productoId, tenantId]
  );

  logger.info('Producto desactivado', { producto_id: productoId });
};
