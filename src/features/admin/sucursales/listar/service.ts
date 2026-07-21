import { query } from '../../../../shared/config/database.js';

export const listarSucursales = async ({ tenantId }: { tenantId: string }) => {
  const { rows } = await query(
    `SELECT id, tenant_id, nombre, direccion, telefono, es_principal, activo, creado_en
     FROM sucursales
     WHERE tenant_id = $1
     ORDER BY es_principal DESC, nombre ASC`,
    [tenantId]
  );
  return rows;
};
