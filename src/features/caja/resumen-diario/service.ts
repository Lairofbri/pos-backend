import { query } from '../../../shared/config/database.js';

export const resumenDiario = async ({ tenantId, fecha }: { tenantId: string; fecha?: string | null }) => {
  const fechaObj = fecha ? new Date(fecha) : new Date();
  const fechaStr = fechaObj.toISOString().split('T')[0];

  const { rows: metodos } = await query(
    `SELECT
       p.metodo,
       COUNT(DISTINCT p.orden_id)::int AS cantidad_ordenes,
       SUM(p.total_pagado) AS total
     FROM pagos p
     WHERE p.tenant_id = $1 AND p.creado_en::date = $2::date
     GROUP BY p.metodo
     ORDER BY p.metodo`,
    [tenantId, fechaStr]
  );

  const { rows: totalRows } = await query(
    `SELECT
       COUNT(DISTINCT p.orden_id)::int AS total_ordenes,
       COALESCE(SUM(p.total_pagado), 0) AS total_ingresos
     FROM pagos p
     WHERE p.tenant_id = $1 AND p.creado_en::date = $2::date`,
    [tenantId, fechaStr]
  );

  const { total_ordenes, total_ingresos } = totalRows[0] as { total_ordenes: string; total_ingresos: string };

  const { rows: ordenesRows } = await query(
    `SELECT
       COUNT(*)::int AS cantidad_ordenes,
       COUNT(*) FILTER (WHERE cliente_id IS NOT NULL)::int AS clientes_atendidos
     FROM ordenes
     WHERE tenant_id = $1 AND estado = 'pagada' AND creado_en::date = $2::date`,
    [tenantId, fechaStr]
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
