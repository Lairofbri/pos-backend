import { query } from '../../../shared/config/database.js';

export const getHistorialCajas = async ({ tenantId, filtros = {} }: { tenantId: string; filtros?: Record<string, unknown> }) => {
  const { estado, fecha_desde, fecha_hasta, pagina = 1, limite = 20 } = filtros as { estado?: string; fecha_desde?: string; fecha_hasta?: string; pagina?: number; limite?: number };

  const condiciones = ['c.tenant_id = $1'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (estado)      { condiciones.push(`c.estado = $${idx++}`);           valores.push(estado); }
  if (fecha_desde) { condiciones.push(`c.fecha_apertura >= $${idx++}`);  valores.push(fecha_desde); }
  if (fecha_hasta) { condiciones.push(`c.fecha_apertura <= $${idx++}`);  valores.push(fecha_hasta); }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       c.id, c.estado,
       c.monto_inicial, c.monto_final,
       c.fecha_apertura, c.fecha_cierre,
       ua.nombre AS usuario_apertura,
       uc.nombre AS usuario_cierre
     FROM cajas c
     JOIN usuarios ua ON ua.id = c.usuario_apertura_id
     LEFT JOIN usuarios uc ON uc.id = c.usuario_cierre_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY c.fecha_apertura DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total FROM cajas c WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    cajas: rows,
    paginacion: {
      total:   parseInt((conteo[0] as { total: string }).total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt((conteo[0] as { total: string }).total) / limite),
    },
  };
};
