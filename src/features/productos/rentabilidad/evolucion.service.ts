import { query } from '../../../shared/config/database.js';

interface EvolucionRow {
  fecha: string;
  ingresos: number;
  costo: number;
  margen_bruto: number;
  margen_pct: number;
  ordenes: number;
}

export const obtenerEvolucion = async ({
  tenantId,
  filtros = {},
}: {
  tenantId: string;
  filtros?: { desde?: string; hasta?: string };
}): Promise<EvolucionRow[]> => {
  const ahora = new Date();
  const hace30d = new Date();
  hace30d.setDate(hace30d.getDate() - 30);

  const desde = filtros.desde || hace30d.toISOString().slice(0, 10);
  const hasta = filtros.hasta || ahora.toISOString().slice(0, 10);

  const { rows: historico } = await query(
    `SELECT
       DATE(o.creado_en) AS fecha,
       COUNT(DISTINCT o.id)::int AS ordenes,
       ROUND(SUM(o.total)::numeric, 2) AS ingresos,
       ROUND(SUM(COALESCE(oi.precio_unitario, p.precio, 0) * oi.cantidad)::numeric, 2) AS venta_items
     FROM ordenes o
     JOIN orden_items oi ON oi.orden_id = o.id
     JOIN productos p ON p.id = oi.producto_id AND p.tenant_id = $1
     WHERE o.estado = 'pagada' AND o.tenant_id = $1
       AND o.creado_en >= $2::date AND o.creado_en < ($3::date + INTERVAL '1 day')
     GROUP BY DATE(o.creado_en)
     ORDER BY fecha ASC`,
    [tenantId, desde, hasta]
  );

  const { rows: costosDiarios } = await query(
    `SELECT
       DATE(o.creado_en) AS fecha,
       p.id AS producto_id,
       p.tiene_receta,
       p.costo_promedio,
       SUM(oi.cantidad)::numeric AS total_cantidad
     FROM ordenes o
     JOIN orden_items oi ON oi.orden_id = o.id
     JOIN productos p ON p.id = oi.producto_id AND p.tenant_id = $1
     WHERE o.estado = 'pagada' AND o.tenant_id = $1
       AND o.creado_en >= $2::date AND o.creado_en < ($3::date + INTERVAL '1 day')
     GROUP BY DATE(o.creado_en), p.id, p.tiene_receta, p.costo_promedio`,
    [tenantId, desde, hasta]
  );

  const costoPorProducto = new Map<string, number>();

  for (const row of costosDiarios as any[]) {
    const prodId = row.producto_id;
    if (costoPorProducto.has(prodId)) continue;

    const tieneReceta = row.tiene_receta;
    const costoPromedio = parseFloat(row.costo_promedio);

    if (!tieneReceta || costoPromedio > 0) {
      costoPorProducto.set(prodId, costoPromedio);
      continue;
    }

    const { rows: recetasRows } = await query(
      `SELECT r.id, r.rendimiento
       FROM recetas r
       WHERE r.producto_id = $1 AND r.vigente_hasta IS NULL
       LIMIT 1`,
      [prodId]
    );

    if (recetasRows.length === 0) {
      costoPorProducto.set(prodId, 0);
      continue;
    }

    const receta = recetasRows[0] as { id: string; rendimiento: number };
    const rendimiento = parseFloat(receta.rendimiento as any) || 1;

    const { rows: ingredientes } = await query(
      `SELECT
         ri.cantidad,
         ing.costo_promedio,
         um_base.factor AS factor_base,
         um_ing.factor AS factor_ingrediente
       FROM receta_ingredientes ri
       JOIN productos ing ON ing.id = ri.ingrediente_id AND ing.tenant_id = $1
       JOIN unidades_medida um_base ON um_base.id = ing.unidad_medida_id
       JOIN unidades_medida um_ing ON um_ing.id = ri.unidad_medida_id
       WHERE ri.receta_id = $2`,
      [tenantId, receta.id]
    );

    if (ingredientes.length === 0) {
      costoPorProducto.set(prodId, 0);
      continue;
    }

    const todosConCosto = (ingredientes as any[]).every(
      (i) => parseFloat(i.costo_promedio) > 0,
    );

    if (!todosConCosto) {
      costoPorProducto.set(prodId, 0);
      continue;
    }

    const costoTotal = (ingredientes as any[]).reduce((sum: number, ing: any) => {
      const factorConversion = parseFloat(ing.factor_ingrediente) / parseFloat(ing.factor_base);
      const cantidadBase = parseFloat(ing.cantidad) * factorConversion;
      return sum + cantidadBase * parseFloat(ing.costo_promedio);
    }, 0);

    const costoPorPorcion = Math.round((costoTotal / rendimiento) * 100) / 100;
    costoPorProducto.set(prodId, costoPorPorcion);
  }

  const costoDiarioMap = new Map<string, number>();
  for (const row of costosDiarios as any[]) {
    const fecha = row.fecha as string;
    const prodId = row.producto_id;
    const cantidad = parseFloat(row.total_cantidad);
    const costo = costoPorProducto.get(prodId) || 0;
    const fechaKey = fecha;
    costoDiarioMap.set(fechaKey, (costoDiarioMap.get(fechaKey) || 0) + cantidad * costo);
  }

  return (historico as any[]).map((row) => {
    const ingresos = parseFloat(row.ingresos);
    const costo = Math.round((costoDiarioMap.get(row.fecha) || 0) * 100) / 100;
    const margen = Math.round((ingresos - costo) * 100) / 100;
    const margenPct = ingresos > 0 ? Math.round((margen / ingresos) * 1000) / 10 : 0;

    return {
      fecha: row.fecha,
      ingresos,
      costo,
      margen_bruto: margen,
      margen_pct: margenPct,
      ordenes: row.ordenes,
    };
  });
};
