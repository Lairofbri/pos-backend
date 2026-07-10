import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { subirImagen } from '../../../../shared/config/storage.js';
import { obtenerProducto } from '../../productos/obtener/service.js';

export const subirImagenProducto = async ({ tenantId, productoId, buffer, mimetype }: { tenantId: string; productoId: string; buffer: Buffer; mimetype: string }) => {
  await obtenerProducto({ tenantId, productoId });

  const imagenUrl = await subirImagen({ tenantId, productoId, buffer, mimetype });

  const { rows } = await query(
    `UPDATE productos SET imagen_url = $1
     WHERE id = $2 AND tenant_id = $3
     RETURNING id, nombre, imagen_url`,
    [imagenUrl, productoId, tenantId]
  );

  logger.info('Imagen asignada a producto', { producto_id: productoId, tenant_id: tenantId });
  return rows[0];
};
