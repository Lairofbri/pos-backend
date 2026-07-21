import { query } from '../../../shared/config/database.js';

export const obtenerCuadre = async ({ tenantId, cajaId }: { tenantId: string; cajaId: string }) => {
  const { rows } = await query(
    `SELECT
       c.id, c.estado, c.sucursal_id,
       c.monto_inicial, c.total_esperado, c.monto_final, c.diferencia,
       c.total_ventas, c.total_efectivo, c.total_tarjeta,
       c.total_retiros, c.total_depositos,
       c.notas_cierre,
       c.fecha_apertura, c.fecha_cierre,
       ua.nombre AS usuario_apertura,
       uc.nombre AS usuario_cierre
     FROM cajas c
     JOIN usuarios ua ON ua.id = c.usuario_apertura_id
     LEFT JOIN usuarios uc ON uc.id = c.usuario_cierre_id
     WHERE c.id = $1 AND c.tenant_id = $2`,
    [cajaId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Caja no encontrada.' };
  }

  const caja = rows[0] as Record<string, unknown>;

  const pagosValores: unknown[] = [tenantId, caja.fecha_apertura, caja.fecha_cierre];
  let pagosSucursalJoin = '';
  let pagosSucursalCond = '';
  if (caja.sucursal_id) {
    pagosSucursalJoin = ' JOIN ordenes o_s ON o_s.id = p.orden_id';
    pagosSucursalCond = ' AND o_s.sucursal_id = $4';
    pagosValores.push(caja.sucursal_id as string);
  }

  const { rows: metodos } = await query(
    `SELECT
       p.metodo,
       COUNT(DISTINCT p.orden_id)::int AS cantidad_ordenes,
       SUM(p.total_pagado) AS total
     FROM pagos p
     ${pagosSucursalJoin}
     WHERE p.tenant_id = $1
       AND p.creado_en >= $2
       AND ($3::timestamptz IS NULL OR p.creado_en <= $3)
       ${pagosSucursalCond}
     GROUP BY p.metodo
     ORDER BY p.metodo`,
    pagosValores
  );

  const { rows: movimientos } = await query(
    `SELECT
       m.id, m.tipo, m.monto, m.motivo,
       m.metodo_pago, m.orden_id, m.creado_en,
       u.nombre AS usuario_nombre
     FROM movimientos_caja m
     JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.caja_id = $1 AND m.tenant_id = $2
     ORDER BY m.creado_en DESC
     LIMIT 50`,
    [cajaId, tenantId]
  );

  return {
    ...caja,
    metodos: (metodos as Array<Record<string, unknown>>).map(m => ({
      metodo: m.metodo,
      cantidad_ordenes: m.cantidad_ordenes,
      total: String(Number(m.total as number).toFixed(2)),
    })),
    movimientos,
  };
};
