import { query } from '../../../shared/config/database.js';

interface RentabilidadProducto {
  id: string;
  nombre: string;
  precio_venta: number;
  costo_promedio: number;
  margen_bruto: number;
  margen_pct: number;
  categoria_nombre: string;
  tiene_receta: boolean;
  stock_actual: number;
  alerta: 'ganancia' | 'equilibrio' | 'perdida' | 'sin_datos';
}

interface IngredienteCostoRow {
  costo_promedio: number;
  cantidad: number;
  factor_base: number;
  factor_ingrediente: number;
}

interface ProductoRow {
  id: string;
  nombre: string;
  precio_venta: unknown;
  costo_promedio: unknown;
  margen_bruto: unknown;
  margen_pct: unknown;
  stock_actual: unknown;
  categoria_nombre: string;
  tiene_receta: boolean;
}

interface RentabilidadResponse {
  productos: RentabilidadProducto[];
  resumen: {
    margen_bruto_total: number;
    food_cost_pct: number;
    sin_costo_count: number;
  };
}

const clasificarAlerta = (margenBruto: number, margenPct: number, costoPromedio: number): RentabilidadProducto['alerta'] => {
  if (costoPromedio === 0) return 'sin_datos';
  if (margenBruto < 0) return 'perdida';
  if (margenPct < 20) return 'equilibrio';
  return 'ganancia';
};

const ordenarPor = (orden: string): string => {
  switch (orden) {
    case 'margen_asc': return 'margen_bruto ASC';
    case 'precio_desc': return 'precio_venta DESC';
    case 'precio_asc': return 'precio_venta ASC';
    case 'nombre': return 'p.nombre ASC';
    default: return 'margen_bruto DESC';
  }
};

export const listarRentabilidad = async ({
  tenantId,
  filtros = {},
}: {
  tenantId: string;
  filtros?: Record<string, unknown>;
}): Promise<RentabilidadResponse> => {
  const { orden = 'margen_desc', categoria_id } = filtros as {
    orden?: string;
    categoria_id?: string;
  };

  const condiciones = ['p.tenant_id = $1', 'p.se_vende = true'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (categoria_id) {
    condiciones.push(`p.categoria_id = $${idx++}`);
    valores.push(categoria_id);
  }

  const orderClause = ordenarPor(orden);

  const { rows: productos } = await query(
    `SELECT
       p.id, p.nombre, p.precio AS precio_venta, p.costo_promedio,
       p.tiene_receta, p.stock_actual,
       c.nombre AS categoria_nombre,
       ROUND((p.precio - p.costo_promedio)::numeric, 2) AS margen_bruto,
       CASE
         WHEN p.precio > 0 THEN ROUND(((p.precio - p.costo_promedio) / p.precio * 100)::numeric, 1)
         ELSE 0
       END AS margen_pct
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY ${orderClause}`,
    valores
  );

  const productosConAlerta = (productos as unknown as ProductoRow[]).map((p) => ({
    ...p,
    precio_venta: Number(p.precio_venta),
    costo_promedio: Number(p.costo_promedio),
    margen_bruto: Number(p.margen_bruto),
    margen_pct: Number(p.margen_pct),
    stock_actual: Number(p.stock_actual),
    alerta: clasificarAlerta(
      Number(p.margen_bruto),
      Number(p.margen_pct),
      Number(p.costo_promedio),
    ),
  })) as RentabilidadProducto[];

  for (const p of productosConAlerta) {
    if (!p.tiene_receta) continue;
    if (p.costo_promedio > 0) continue;

    const { rows: recetasRows } = await query(
      `SELECT r.id, r.rendimiento
       FROM recetas r
       WHERE r.producto_id = $1 AND r.vigente_hasta IS NULL
       LIMIT 1`,
      [p.id]
    );

    if (recetasRows.length === 0) continue;

    const receta = recetasRows[0] as { id: string; rendimiento: number };
    const rendimiento = Number(receta.rendimiento) || 1;

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

    if (ingredientes.length === 0) continue;

    const todosConCosto = (ingredientes as unknown as IngredienteCostoRow[]).every(
      (i) => Number(i.costo_promedio) > 0,
    );
  
    if (!todosConCosto) continue;

    const costoTotal = (ingredientes as unknown as IngredienteCostoRow[]).reduce((sum, ing) => {
      const factorConversion = Number(ing.factor_ingrediente) / Number(ing.factor_base);
      const cantidadBase = Number(ing.cantidad) * factorConversion;
      return sum + cantidadBase * Number(ing.costo_promedio);
    }, 0);

    const costoPorPorcion = Math.round((costoTotal / rendimiento) * 100) / 100;

    p.costo_promedio = costoPorPorcion;
    p.margen_bruto = Math.round((p.precio_venta - costoPorPorcion) * 100) / 100;
    p.margen_pct = p.precio_venta > 0
      ? Math.round(((p.precio_venta - costoPorPorcion) / p.precio_venta) * 1000) / 10
      : 0;
    p.alerta = clasificarAlerta(p.margen_bruto, p.margen_pct, costoPorPorcion);
  }

  const margenBrutoTotal = Math.round(
    productosConAlerta.reduce((sum, p) => sum + p.margen_bruto, 0) * 100,
  ) / 100;

  const ventaTotal = productosConAlerta.reduce((sum, p) => sum + p.precio_venta, 0);
  const costoCosto = ventaTotal - margenBrutoTotal;
  const foodCostPct = ventaTotal > 0
    ? Math.round((costoCosto / ventaTotal) * 1000) / 10
    : 0;

  const sinCostoCount = productosConAlerta.filter(
    (p) => p.costo_promedio === 0 && p.alerta === 'sin_datos',
  ).length;

  return {
    productos: productosConAlerta,
    resumen: {
      margen_bruto_total: margenBrutoTotal,
      food_cost_pct: foodCostPct,
      sin_costo_count: sinCostoCount,
    },
  };
};
