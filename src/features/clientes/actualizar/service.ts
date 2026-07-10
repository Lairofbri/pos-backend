import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerCliente } from '../obtener/service.js';

const formatearCliente = (row: Record<string, unknown>) => ({
  ...row,
  nombre_completo: row.razon_social || `${row.nombre}${row.apellido ? ' ' + row.apellido : ''}`,
  es_empresa: !!row.razon_social,
});

export const actualizarCliente = async ({ tenantId, clienteId, datos }: { tenantId: string; clienteId: string; datos: Record<string, unknown> }) => {
  await obtenerCliente({ tenantId, clienteId });

  if (datos.nit) {
    const { rows: existeNit } = await query(
      'SELECT id FROM clientes WHERE tenant_id = $1 AND nit = $2 AND id != $3',
      [tenantId, datos.nit, clienteId]
    );
    if (existeNit.length > 0) {
      throw { status: 409, mensaje: `Ya existe otro cliente con el NIT ${datos.nit}.` };
    }
  }

  if (datos.nrc) {
    const { rows: existeNrc } = await query(
      'SELECT id FROM clientes WHERE tenant_id = $1 AND nrc = $2 AND id != $3',
      [tenantId, datos.nrc, clienteId]
    );
    if (existeNrc.length > 0) {
      throw { status: 409, mensaje: `Ya existe otro cliente con el NRC ${datos.nrc}.` };
    }
  }

  const camposPermitidos = [
    'nombre', 'apellido', 'telefono', 'email',
    'tipo_documento', 'numero_documento',
    'nit', 'nrc', 'razon_social',
    'direccion', 'municipio', 'departamento', 'activo',
  ];

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  for (const campo of camposPermitidos) {
    if (datos[campo] !== undefined) {
      campos.push(`${campo} = $${idx++}`);
      valores.push(datos[campo]);
    }
  }

  if (campos.length === 0) {
    throw { status: 400, mensaje: 'No hay campos para actualizar.' };
  }

  valores.push(clienteId, tenantId);

  const { rows } = await query(
    `UPDATE clientes SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, nombre, apellido, telefono, email,
               tipo_documento, numero_documento,
               nit, nrc, razon_social,
               direccion, municipio, departamento, activo`,
    valores
  );

  logger.info('Cliente actualizado', { cliente_id: clienteId });
  return formatearCliente(rows[0] as Record<string, unknown>);
};
