import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerPermisosRol } from '../rol-obtener/service.js';

export const resetearPermisosRol = async ({ tenantId, rol }: { tenantId: string; rol: string }) => {
  await query('CALL sp_resetear_permisos_rol($1, $2)', [rol, tenantId]);
  logger.info('Permisos reseteados a defaults', { tenant_id: tenantId, rol });
  return obtenerPermisosRol({ tenantId, rol });
};
