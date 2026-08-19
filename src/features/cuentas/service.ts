import { query } from '../../shared/config/database.js';

export interface ListarCuentasParams {
  tenantId: string;
  sucursalId?: string;
  filtros: {
    fecha_desde?: string;
    fecha_hasta?: string;
    tipo?: string;
    pagina: number;
    limite: number;
  };
}

export interface ExportarCuentasParams {
  tenantId: string;
  sucursalId?: string;
  filtros: {
    fecha_desde?: string;
    fecha_hasta?: string;
    tipo?: string;
  };
}

export const listarCuentas = async ({ tenantId, sucursalId, filtros }: ListarCuentasParams) => {
  const { fecha_desde, fecha_hasta, tipo, pagina, limite } = filtros;

  const condiciones = ['o.tenant_id = $1'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (sucursalId) {
    condiciones.push(`o.sucursal_id = $${idx++}`);
    valores.push(sucursalId);
  }

  condiciones.push(`o.estado IN ('pagada', 'cancelada')`);

  if (tipo) {
    condiciones.push(`o.tipo = $${idx++}`);
    valores.push(tipo);
  }

  const fechaDesde = fecha_desde
    ? fecha_desde
    : new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
  const fechaHasta = fecha_hasta
    ? fecha_hasta
    : new Date().toISOString().split('T')[0] + 'T23:59:59.999Z';

  condiciones.push(`o.creado_en >= $${idx++}`);
  valores.push(fechaDesde);
  condiciones.push(`o.creado_en <= $${idx++}`);
  valores.push(fechaHasta);

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       o.id, o.tipo, o.estado, o.numero_orden, o.origen,
       o.total, o.creado_en,
       m.numero AS mesa_numero,
       CONCAT_WS(' ', c.nombre, c.apellido) AS cliente_nombre,
       u.nombre AS usuario_nombre,
       COUNT(oi.id) AS total_items,
       d.tipo_dte AS dte_tipo,
       d.codigo_generacion AS dte_codigo_generacion,
       d.estado AS dte_estado
     FROM ordenes o
     LEFT JOIN mesas m ON m.id = o.mesa_id
     LEFT JOIN clientes c ON c.id = o.cliente_id
     LEFT JOIN usuarios u ON u.id = o.usuario_id
     LEFT JOIN orden_items oi ON oi.orden_id = o.id AND oi.estado != 'cancelado'
     LEFT JOIN LATERAL (
       SELECT tipo_dte, codigo_generacion, estado, creado_en
       FROM dtes_orden
       WHERE orden_id = o.id
       ORDER BY creado_en DESC
       LIMIT 1
     ) d ON true
     WHERE ${condiciones.join(' AND ')}
     GROUP BY o.id, m.numero, c.nombre, c.apellido, u.nombre, d.tipo_dte, d.codigo_generacion, d.estado
     ORDER BY o.creado_en DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total
     FROM ordenes o
     WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    cuentas: rows,
    paginacion: {
      total: parseInt((conteo[0] as { total: string }).total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt((conteo[0] as { total: string }).total) / limite),
    },
  };
};

export const exportarCuentas = async ({ tenantId, sucursalId, filtros }: ExportarCuentasParams) => {
  const { fecha_desde, fecha_hasta, tipo } = filtros;

  const condiciones = ['o.tenant_id = $1'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (sucursalId) {
    condiciones.push(`o.sucursal_id = $${idx++}`);
    valores.push(sucursalId);
  }

  condiciones.push(`o.estado IN ('pagada', 'cancelada')`);

  if (tipo) {
    condiciones.push(`o.tipo = $${idx++}`);
    valores.push(tipo);
  }

  const fechaDesde = fecha_desde
    ? fecha_desde
    : new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
  const fechaHasta = fecha_hasta
    ? fecha_hasta
    : new Date().toISOString().split('T')[0] + 'T23:59:59.999Z';

  condiciones.push(`o.creado_en >= $${idx++}`);
  valores.push(fechaDesde);
  condiciones.push(`o.creado_en <= $${idx++}`);
  valores.push(fechaHasta);

  const { rows } = await query(
    `SELECT
       o.id, o.tipo, o.estado, o.numero_orden, o.origen,
       o.total, o.subtotal, o.iva, o.propina_porcentaje, o.propina_monto,
       o.creado_en, o.actualizado_en,
       m.numero AS mesa_numero,
       CONCAT_WS(' ', c.nombre, c.apellido) AS cliente_nombre,
       u.nombre AS usuario_nombre,
       COUNT(oi.id) AS total_items,
       d.tipo_dte AS dte_tipo,
       d.codigo_generacion AS dte_codigo_generacion,
       d.numero_control AS dte_numero_control,
       d.estado AS dte_estado,
       d.json_envio AS dte_json_envio,
       d.json_respuesta AS dte_json_respuesta,
       d.creado_en AS dte_emitido_en
     FROM ordenes o
     LEFT JOIN mesas m ON m.id = o.mesa_id
     LEFT JOIN clientes c ON c.id = o.cliente_id
     LEFT JOIN usuarios u ON u.id = o.usuario_id
     LEFT JOIN orden_items oi ON oi.orden_id = o.id AND oi.estado != 'cancelado'
     LEFT JOIN LATERAL (
       SELECT tipo_dte, codigo_generacion, numero_control, estado, json_envio, json_respuesta, creado_en
       FROM dtes_orden
       WHERE orden_id = o.id
       ORDER BY creado_en DESC
       LIMIT 1
     ) d ON true
     WHERE ${condiciones.join(' AND ')}
     GROUP BY o.id, m.numero, c.nombre, c.apellido, u.nombre,
       d.tipo_dte, d.codigo_generacion, d.numero_control, d.estado, d.json_envio, d.json_respuesta, d.creado_en
     ORDER BY o.creado_en DESC`,
    valores
  );

  return rows;
};
