import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { eliminarImagen } from '../../../../shared/config/storage.js';
import { obtenerProducto } from '../../productos/obtener/service.js';

export const eliminarImagenProducto = async ({ tenantId, productoId }: { tenantId: string; productoId: string }) => {
  const producto = await obtenerProducto({ tenantId, productoId }) as { imagen_url: string | null };

  if (!producto.imagen_url) {
    throw { status: 404, mensaje: 'El producto no tiene imagen asignada.' };
  }

  await eliminarImagen({ tenantId, productoId });

  const { rows } = await query(
    `UPDATE productos SET imagen_url = NULL
     WHERE id = $1 AND tenant_id = $2
     RETURNING id, nombre, imagen_url`,
    [productoId, tenantId]
  );

  logger.info('Imagen eliminada de producto', { producto_id: productoId, tenant_id: tenantId });
  return rows[0];
};
