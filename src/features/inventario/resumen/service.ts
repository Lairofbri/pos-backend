import { query } from '../../../shared/config/database.js';
import { servicioEmpresaDte } from '../../../shared/dte-empresa.js';

export const obtenerResumen = async ({ tenantId }: { tenantId: string }) => {
  const { rows: productosConStock } = await query(
    `SELECT COUNT(*)::INTEGER AS cantidad
     FROM productos
     WHERE tenant_id = $1 AND tiene_stock = TRUE`,
    [tenantId]
  );

  const { rows: alertas } = await query(
    `SELECT COUNT(*)::INTEGER AS cantidad
     FROM productos
     WHERE tenant_id = $1 AND tiene_stock = TRUE AND stock_actual < stock_minimo`,
    [tenantId]
  );

  const { rows: movimientosHoy } = await query(
    `SELECT COUNT(*)::INTEGER AS cantidad
     FROM movimientos_inventario
     WHERE tenant_id = $1 AND creado_en >= CURRENT_DATE`,
    [tenantId]
  );

  const { rows: consumidoHoy } = await query(
    `SELECT COALESCE(SUM(cantidad), 0)::INTEGER AS cantidad
     FROM movimientos_inventario
     WHERE tenant_id = $1 AND tipo_movimiento = 'consumo' AND creado_en >= CURRENT_DATE`,
    [tenantId]
  );

  const { rows: ultimosMovimientos } = await query(
    `SELECT
       m.id, m.producto_id, m.tipo_movimiento, m.cantidad,
       m.stock_anterior, m.stock_posterior, m.motivo,
       m.referencia_tipo, m.creado_en,
       m.sucursal_id,
       m.unidad_medida_id,
       u.nombre AS unidad_nombre, u.abreviatura AS unidad_abrev,
       p.nombre AS producto_nombre,
       uu.nombre AS creado_por_nombre
     FROM movimientos_inventario m
     JOIN productos p ON p.id = m.producto_id AND p.tenant_id = $1
     LEFT JOIN unidades_medida u ON u.id = m.unidad_medida_id
     LEFT JOIN usuarios uu ON uu.id = m.creado_por
     WHERE m.tenant_id = $1
     ORDER BY m.creado_en DESC
     LIMIT 10`,
    [tenantId]
  );

  // F3 — el nombre de la sucursal (establecimiento) sale del DTE.
  const nombres = await servicioEmpresaDte.mapaNombresEstablecimiento(tenantId);
  const movimientosEnriquecidos = (ultimosMovimientos as Array<Record<string, unknown>>).map((m) => ({
    ...m,
    sucursal_nombre: m.sucursal_id ? nombres.get(String(m.sucursal_id)) ?? null : null,
  }));

  const { rows: alertasDetalle } = await query(
    `SELECT id, nombre, stock_actual, stock_minimo
     FROM productos
     WHERE tenant_id = $1 AND tiene_stock = TRUE AND stock_actual < stock_minimo
     ORDER BY stock_actual ASC
     LIMIT 20`,
    [tenantId]
  );

  return {
    productos_con_stock: (productosConStock[0] as { cantidad: number }).cantidad,
    alertas_count: (alertas[0] as { cantidad: number }).cantidad,
    movimientos_hoy: (movimientosHoy[0] as { cantidad: number }).cantidad,
    consumido_hoy: (consumidoHoy[0] as { cantidad: number }).cantidad,
    ultimos_movimientos: movimientosEnriquecidos,
    alertas: alertasDetalle,
  };
};
