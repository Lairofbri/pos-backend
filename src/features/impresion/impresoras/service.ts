import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';

export const listar = async (tenantId: string) => {
  const { rows } = await query(
    'SELECT * FROM impresoras WHERE tenant_id = $1 ORDER BY tipo, nombre',
    [tenantId]
  );
  return rows;
};

export const obtener = async (tenantId: string, id: string) => {
  const { rows } = await query(
    'SELECT * FROM impresoras WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  if (rows.length === 0) throw { status: 404, mensaje: 'Impresora no encontrada.' };
  return rows[0];
};

export const crear = async (tenantId: string, datos: Record<string, unknown>) => {
  const { nombre, tipo, conexion = 'red', ip, puerto = 9100, papel_mm = 80, caracteres_x_linea = 42 } = datos as { nombre: string; tipo: string; conexion?: string; ip: string; puerto?: number; papel_mm?: number; caracteres_x_linea?: number };

  const { rows } = await query(
    `INSERT INTO impresoras
       (tenant_id, nombre, tipo, conexion, ip, puerto, papel_mm, caracteres_x_linea)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [tenantId, nombre, tipo, conexion, ip, puerto, papel_mm, caracteres_x_linea]
  );

  logger.info('Impresora creada', { tenant_id: tenantId, nombre, tipo });
  return rows[0];
};

export const actualizar = async (tenantId: string, id: string, datos: Record<string, unknown>) => {
  await obtener(tenantId, id);

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  if (datos.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(datos.nombre); }
  if (datos.tipo !== undefined) { campos.push(`tipo = $${idx++}`); valores.push(datos.tipo); }
  if (datos.ip !== undefined) { campos.push(`ip = $${idx++}`); valores.push(datos.ip); }
  if (datos.puerto !== undefined) { campos.push(`puerto = $${idx++}`); valores.push(datos.puerto); }
  if (datos.papel_mm !== undefined) { campos.push(`papel_mm = $${idx++}`); valores.push(datos.papel_mm); }
  if (datos.caracteres_x_linea !== undefined) { campos.push(`caracteres_x_linea = $${idx++}`); valores.push(datos.caracteres_x_linea); }
  if (datos.activo !== undefined) { campos.push(`activo = $${idx++}`); valores.push(datos.activo); }

  if (campos.length === 0) return obtener(tenantId, id);

  campos.push('actualizado_en = NOW()');
  valores.push(id, tenantId);

  const { rows } = await query(
    `UPDATE impresoras SET ${campos.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING *`,
    valores
  );

  logger.info('Impresora actualizada', { id, tenant_id: tenantId });
  return rows[0];
};

export const eliminar = async (tenantId: string, id: string) => {
  await obtener(tenantId, id);
  await query('DELETE FROM impresoras WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  logger.info('Impresora eliminada', { id, tenant_id: tenantId });
};
