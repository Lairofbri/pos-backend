import { query } from '../../../shared/config/database.js';

const formatearCliente = (row: Record<string, unknown>) => ({
  ...row,
  nombre_completo: row.razon_social || `${row.nombre}${row.apellido ? ' ' + row.apellido : ''}`,
  es_empresa: !!row.razon_social,
});

export const obtenerCliente = async ({ tenantId, clienteId }: { tenantId: string; clienteId: string }) => {
  const { rows } = await query(
    `SELECT id, nombre, apellido, telefono, email,
            tipo_documento, numero_documento,
            nit, nrc, razon_social,
            direccion, municipio, departamento,
            activo, creado_en, actualizado_en
     FROM clientes
     WHERE id = $1 AND tenant_id = $2`,
    [clienteId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Cliente no encontrado.' };
  }

  return formatearCliente(rows[0] as Record<string, unknown>);
};
