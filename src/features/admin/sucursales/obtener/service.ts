import { query } from '../../../../shared/config/database.js';

export const obtenerSucursal = async ({ tenantId, sucursalId }: { tenantId: string; sucursalId: string }) => {
  const { rows } = await query(
    `SELECT id, tenant_id, nombre, direccion, telefono, es_principal, activo, creado_en
     FROM sucursales
     WHERE id = $1 AND tenant_id = $2`,
    [sucursalId, tenantId]
  );
  if (rows.length === 0) throw { status: 404, mensaje: 'Sucursal no encontrada.' };
  return rows[0];
};
