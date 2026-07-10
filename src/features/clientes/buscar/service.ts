import { query } from '../../../shared/config/database.js';

const normalizarTexto = (texto: string) => {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const formatearCliente = (row: Record<string, unknown>) => ({
  ...row,
  nombre_completo: row.razon_social || `${row.nombre}${row.apellido ? ' ' + row.apellido : ''}`,
  es_empresa: !!row.razon_social,
});

export const buscarClientes = async ({ tenantId, q }: { tenantId: string; q?: string }) => {
  if (!q || q.trim().length < 2) {
    throw { status: 400, mensaje: 'Ingresa al menos 2 caracteres para buscar.' };
  }

  const termino = normalizarTexto(q);

  const { rows } = await query(
    `SELECT
       id, nombre, apellido, razon_social,
       nit, nrc, numero_documento, tipo_documento,
       telefono, direccion
     FROM clientes
     WHERE tenant_id = $1
       AND activo = TRUE
       AND (
         nombre ILIKE $2 OR apellido ILIKE $2 OR
         razon_social ILIKE $2 OR nit ILIKE $2 OR
         nrc ILIKE $2 OR numero_documento ILIKE $2
       )
     ORDER BY nombre ASC
     LIMIT 10`,
    [tenantId, `%${termino}%`]
  );

  return rows.map(formatearCliente);
};
