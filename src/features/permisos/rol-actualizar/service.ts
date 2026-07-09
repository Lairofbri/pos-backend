import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerPermisosRol } from '../rol-obtener/service.js';

export const actualizarPermisosRol = async ({ tenantId, rol, permisos }: { tenantId: string; rol: string; permisos: { codigo: string; activo: boolean }[] }) => {
  for (const { codigo, activo } of permisos) {
    await query(
      `INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
       SELECT $1, p.id, $2, $3
       FROM permisos p
       WHERE p.codigo = $4
       ON CONFLICT (rol, permiso_id, tenant_id) DO UPDATE SET activo = $3`,
      [rol, tenantId, activo, codigo]
    );
  }

  logger.info('Permisos actualizados', { tenant_id: tenantId, rol, cambios: permisos.length });
  return obtenerPermisosRol({ tenantId, rol });
};
