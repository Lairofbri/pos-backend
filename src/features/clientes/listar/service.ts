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

export const listarClientes = async ({ tenantId, filtros = {} }: { tenantId: string; filtros?: Record<string, unknown> }) => {
  const { q, activo, pagina = 1, limite = 20 } = filtros as { q?: string; activo?: boolean; pagina?: number; limite?: number };

  const condiciones = ['tenant_id = $1'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (activo !== undefined) {
    condiciones.push(`activo = $${idx++}`);
    valores.push(activo);
  }

  if (q && (q as string).trim()) {
    const termino = normalizarTexto(q as string);
    condiciones.push(`(
      nombre ILIKE $${idx} OR apellido ILIKE $${idx} OR
      razon_social ILIKE $${idx} OR nit ILIKE $${idx} OR
      nrc ILIKE $${idx} OR numero_documento ILIKE $${idx} OR
      telefono ILIKE $${idx}
    )`);
    valores.push(`%${termino}%`);
    idx++;
  }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT id, nombre, apellido, telefono, email,
            tipo_documento, numero_documento,
            nit, nrc, razon_social,
            direccion, municipio, departamento,
            activo, creado_en
     FROM clientes
     WHERE ${condiciones.join(' AND ')}
     ORDER BY nombre ASC, apellido ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total FROM clientes WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    clientes: rows.map(formatearCliente),
    paginacion: {
      total: parseInt((conteo[0] as { total: string }).total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt((conteo[0] as { total: string }).total) / limite),
    },
  };
};
