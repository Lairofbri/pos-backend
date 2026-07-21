import { query } from '../../../../shared/config/database.js';
import { obtenerSucursal } from '../obtener/service.js';
import { logger } from '../../../../shared/utils/logger.js';

export const actualizarSucursal = async ({ tenantId, sucursalId, datos }: { tenantId: string; sucursalId: string; datos: Record<string, unknown> }) => {
  await obtenerSucursal({ tenantId, sucursalId });

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  if (datos.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(datos.nombre); }
  if (datos.direccion !== undefined) { campos.push(`direccion = $${idx++}`); valores.push(datos.direccion); }
  if (datos.telefono !== undefined) { campos.push(`telefono = $${idx++}`); valores.push(datos.telefono); }
  if (datos.es_principal !== undefined) { campos.push(`es_principal = $${idx++}`); valores.push(datos.es_principal); }
  if (datos.activo !== undefined) { campos.push(`activo = $${idx++}`); valores.push(datos.activo); }

  if (campos.length === 0) {
    throw { status: 400, mensaje: 'No hay campos para actualizar.' };
  }

  valores.push(sucursalId, tenantId);
  const { rows } = await query(
    `UPDATE sucursales SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, tenant_id, nombre, direccion, telefono, es_principal, activo, creado_en`,
    valores
  );

  logger.info('Sucursal actualizada', { sucursal_id: sucursalId, tenant_id: tenantId });
  return rows[0];
};
