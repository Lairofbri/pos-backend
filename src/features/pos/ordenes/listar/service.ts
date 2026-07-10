import { query } from '../../../../shared/config/database.js';
import { ESTADOS_FINALES } from '../../../../shared/utils/constants.js';

export const listarOrdenes = async ({ tenantId, filtros = {} }: { tenantId: string; filtros: Record<string, unknown> }) => {
  const {
    estado, tipo, origen, usuario_id,
    fecha_desde, fecha_hasta, activas,
    pagina = 1, limite = 50,
  } = filtros as {
    estado?: string;
    tipo?: string;
    origen?: string;
    usuario_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    activas?: boolean;
    pagina: number;
    limite: number;
  };

  const condiciones = ['o.tenant_id = $1'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (estado) { condiciones.push(`o.estado = $${idx++}`); valores.push(estado); }
  if (tipo) { condiciones.push(`o.tipo = $${idx++}`); valores.push(tipo); }
  if (origen) { condiciones.push(`o.origen = $${idx++}`); valores.push(origen); }
  if (usuario_id) { condiciones.push(`o.usuario_id = $${idx++}`); valores.push(usuario_id); }
  if (fecha_desde) { condiciones.push(`o.creado_en >= $${idx++}`); valores.push(fecha_desde); }
  if (fecha_hasta) { condiciones.push(`o.creado_en <= $${idx++}`); valores.push(fecha_hasta); }
  if (activas) {
    const estadosFinales = ESTADOS_FINALES.map(e => `'${e}'`).join(',');
    condiciones.push(`o.estado NOT IN (${estadosFinales})`);
  }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       o.id, o.tipo, o.estado, o.numero_orden, o.origen, o.numero_externo,
       o.subtotal, o.porcentaje_descuento, o.descuento,
       o.total, o.gravado, o.iva, o.notas,
       o.propina_porcentaje, o.propina_monto,
       o.mesa_id, o.cliente_id, o.usuario_id,
       o.creado_en, o.actualizado_en,
       m.numero AS mesa_numero, m.zona,
       CONCAT_WS(' ', c.nombre, c.apellido) AS cliente_nombre,
       u.nombre AS usuario_nombre,
       COUNT(oi.id) AS total_items
     FROM ordenes o
     LEFT JOIN mesas m ON m.id = o.mesa_id
     LEFT JOIN clientes c ON c.id = o.cliente_id
     LEFT JOIN usuarios u ON u.id = o.usuario_id
     LEFT JOIN orden_items oi ON oi.orden_id = o.id AND oi.estado != 'cancelado'
     WHERE ${condiciones.join(' AND ')}
     GROUP BY o.id, m.numero, m.zona, c.nombre, c.apellido, u.nombre
     ORDER BY o.creado_en DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total FROM ordenes o WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    ordenes: rows,
    paginacion: {
      total: parseInt((conteo[0] as { total: string }).total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt((conteo[0] as { total: string }).total) / limite),
    },
  };
};
