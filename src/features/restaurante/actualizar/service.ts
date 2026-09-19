import { query } from '../../../shared/config/database.js';
import { obtenerRestaurante } from '../obtener/service.js';
import { logger } from '../../../shared/utils/logger.js';

export const actualizarRestaurante = async ({ tenantId, datos }: { tenantId: string; datos: Record<string, unknown> }) => {
  await obtenerRestaurante({ tenantId });

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  if (datos.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(datos.nombre); }
  if (datos.nit !== undefined) { campos.push(`nit = $${idx++}`); valores.push(datos.nit || null); }
  if (datos.nrc !== undefined) { campos.push(`nrc = $${idx++}`); valores.push(datos.nrc || null); }
  if (datos.direccion !== undefined) { campos.push(`direccion = $${idx++}`); valores.push(datos.direccion || null); }
  if (datos.telefono !== undefined) { campos.push(`telefono = $${idx++}`); valores.push(datos.telefono || null); }
  if (datos.email !== undefined) { campos.push(`email = $${idx++}`); valores.push(datos.email || null); }
  if (datos.logo_url !== undefined) { campos.push(`logo_url = $${idx++}`); valores.push(datos.logo_url || null); }
  if (datos.pos_default_mode !== undefined) { campos.push(`pos_default_mode = $${idx++}`); valores.push(datos.pos_default_mode); }

  if (campos.length === 0) {
    throw { status: 400, mensaje: 'No hay campos para actualizar.' };
  }

  valores.push(tenantId);
  const { rows } = await query(
    `UPDATE tenants SET ${campos.join(', ')}
     WHERE id = $${idx++}
     RETURNING id, nombre, nit, nrc, direccion, telefono, email, logo_url, plan, pos_default_mode`,
    valores
  );

  logger.info('Restaurante actualizado', { tenant_id: tenantId });
  return rows[0];
};
