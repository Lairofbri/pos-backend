import { query } from '../../../shared/config/database.js';

export const resumenDiario = async ({ tenantId, fecha, sucursalId }: { tenantId: string; fecha?: string | null; sucursalId?: string }) => {
  const fechaObj = fecha ? new Date(fecha) : new Date();
  const fechaStr = fechaObj.toISOString().split('T')[0];

  let sucursalJoin = '';
  let sucursalCondicion = '';
  const valoresBase: unknown[] = [tenantId, fechaStr];
  if (sucursalId) {
    sucursalJoin = ' JOIN ordenes o_s ON o_s.id = p.orden_id';
    sucursalCondicion = ` AND o_s.sucursal_id = $3`;
    valoresBase.push(sucursalId);
  }

  const { rows: metodos } = await query(
    `SELECT
       p.metodo,
       COUNT(DISTINCT p.orden_id)::int AS cantidad_ordenes,
       SUM(p.total_pagado) AS total
     FROM pagos p
     ${sucursalJoin}
     WHERE p.tenant_id = $1 AND p.creado_en::date = $2::date
       ${sucursalCondicion}
     GROUP BY p.metodo
     ORDER BY p.metodo`,
    valoresBase
  );

  const { rows: totalRows } = await query(
    `SELECT
       COUNT(DISTINCT p.orden_id)::int AS total_ordenes,
       COALESCE(SUM(p.total_pagado), 0) AS total_ingresos
     FROM pagos p
     ${sucursalJoin}
     WHERE p.tenant_id = $1 AND p.creado_en::date = $2::date
       ${sucursalCondicion}`,
    valoresBase
  );

  const { total_ordenes, total_ingresos } = totalRows[0] as { total_ordenes: string; total_ingresos: string };

  let ordenesCondicion = '';
  const valoresOrdenes: unknown[] = [tenantId, fechaStr];
  if (sucursalId) {
    ordenesCondicion = ` AND sucursal_id = $3`;
    valoresOrdenes.push(sucursalId);
  }

  const { rows: ordenesRows } = await query(
    `SELECT
       COUNT(*)::int AS cantidad_ordenes,
       COUNT(*) FILTER (WHERE cliente_id IS NOT NULL)::int AS clientes_atendidos
     FROM ordenes
     WHERE tenant_id = $1 AND estado = 'pagada' AND creado_en::date = $2::date
       ${ordenesCondicion}`,
    valoresOrdenes
  );

  const { cantidad_ordenes, clientes_atendidos } = ordenesRows[0] as { cantidad_ordenes: string; clientes_atendidos: string };

  const ticket_promedio = Number(cantidad_ordenes) > 0
    ? Number((Number(total_ingresos) / Number(cantidad_ordenes)).toFixed(2))
    : 0;

  return {
    total_ordenes: Number(total_ordenes),
    total_ingresos: String(Number(total_ingresos).toFixed(2)),
    cantidad_ordenes: Number(cantidad_ordenes),
    ticket_promedio,
    clientes_atendidos: Number(clientes_atendidos),
    metodos: (metodos as Array<Record<string, unknown>>).map(m => ({
      metodo: m.metodo,
      cantidad_ordenes: m.cantidad_ordenes,
      total: String(Number(m.total as number).toFixed(2)),
    })),
  };
};
