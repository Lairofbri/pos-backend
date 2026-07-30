import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';

export const desactivarUnidad = async ({ tenantId, unidadId }: { tenantId: string; unidadId: string }) => {
  const { rows: existe } = await query(
    'SELECT id, nombre FROM unidades_medida WHERE id = $1 AND tenant_id = $2',
    [unidadId, tenantId]
  );

  if (existe.length === 0) {
    throw { status: 404, mensaje: 'Unidad de medida no encontrada.' };
  }

  const { rows: enUso } = await query(
    `SELECT COUNT(*) as total FROM productos
     WHERE tenant_id = $1 AND unidad_medida_id = $2 AND activo = TRUE`,
    [tenantId, unidadId]
  );

  if (parseInt((enUso[0] as { total: string }).total) > 0) {
    throw { status: 400, mensaje: 'No se puede desactivar: la unidad está en uso por productos activos.' };
  }

  await query(
    'UPDATE unidades_medida SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [unidadId, tenantId]
  );

  logger.info('Unidad de medida desactivada', { id: unidadId });
};
