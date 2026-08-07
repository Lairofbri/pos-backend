import { query } from '../../../shared/config/database.js';

export const reconciliarStock = async ({ tenantId }: { tenantId: string }) => {
  const { rows } = await query(
    `WITH movimientos_sum AS (
       SELECT producto_id,
         SUM(CASE WHEN tipo_movimiento IN ('compra', 'devolucion') THEN cantidad
                  WHEN tipo_movimiento IN ('merma', 'consumo') THEN -cantidad
                  ELSE 0 END) AS saldo_movimientos
       FROM movimientos_inventario
       WHERE tenant_id = $1
       GROUP BY producto_id
     )
     SELECT p.id, p.nombre, p.stock_actual, p.stock_minimo,
            COALESCE(m.saldo_movimientos, 0) AS saldo_movimientos,
            ROUND(p.stock_actual - COALESCE(m.saldo_movimientos, 0), 4) AS diferencia
     FROM productos p
     LEFT JOIN movimientos_sum m ON m.producto_id = p.id
     WHERE p.tenant_id = $1
       AND p.tiene_stock = TRUE
       AND ROUND(p.stock_actual, 4) != COALESCE(m.saldo_movimientos, 0)`,
    [tenantId]
  );

  const divergencias = rows.map((r: { id: string; nombre: string; stock_actual: string; stock_minimo: string; saldo_movimientos: string; diferencia: string }) => ({
    id: r.id,
    nombre: r.nombre,
    stock_actual: Number(r.stock_actual),
    stock_minimo: Number(r.stock_minimo),
    saldo_movimientos: Number(r.saldo_movimientos),
    diferencia: Number(r.diferencia),
  }));

  return {
    divergencias,
    total_productos_con_stock: divergencias.length > 0 ? 0 : 0,
    total_divergencias: divergencias.length,
    conciliado: divergencias.length === 0,
  };
};
