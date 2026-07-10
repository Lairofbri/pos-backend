import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';

const formatearCliente = (row: Record<string, unknown>) => ({
  ...row,
  nombre_completo: row.razon_social || `${row.nombre}${row.apellido ? ' ' + row.apellido : ''}`,
  es_empresa: !!row.razon_social,
});

export const crearCliente = async ({ tenantId, datos }: { tenantId: string; datos: Record<string, unknown> }) => {
  const { nombre, apellido, telefono, email, tipo_documento, numero_documento, nit, nrc, razon_social, direccion, municipio, departamento } = datos;

  if (nit) {
    const { rows: existeNit } = await query(
      'SELECT id FROM clientes WHERE tenant_id = $1 AND nit = $2',
      [tenantId, nit]
    );
    if (existeNit.length > 0) {
      throw { status: 409, mensaje: `Ya existe un cliente registrado con el NIT ${nit}.` };
    }
  }

  if (nrc) {
    const { rows: existeNrc } = await query(
      'SELECT id FROM clientes WHERE tenant_id = $1 AND nrc = $2',
      [tenantId, nrc]
    );
    if (existeNrc.length > 0) {
      throw { status: 409, mensaje: `Ya existe un cliente registrado con el NRC ${nrc}.` };
    }
  }

  const { rows } = await query(
    `INSERT INTO clientes (
       tenant_id, nombre, apellido, telefono, email,
       tipo_documento, numero_documento, nit, nrc, razon_social,
       direccion, municipio, departamento
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, nombre, apellido, telefono, email,
               tipo_documento, numero_documento,
               nit, nrc, razon_social,
               direccion, municipio, departamento,
               activo, creado_en`,
    [tenantId, nombre, apellido || null, telefono || null, email || null,
     tipo_documento || 'dui', numero_documento || null, nit || null, nrc || null,
     razon_social || null, direccion || null, municipio || null, departamento || null]
  );

  logger.info('Cliente creado', { tenant_id: tenantId, cliente_id: (rows[0] as Record<string, unknown>).id, nombre: nombre as string, nit: (nit as string) || 'N/A' });

  return formatearCliente(rows[0] as Record<string, unknown>);
};
