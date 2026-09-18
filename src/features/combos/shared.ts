import { query } from '../../shared/config/database.js';

export interface ComboComponentRow {
  producto_id: string;
  cantidad: number;
  nombre: string;
  precio: number;
  tiene_stock: boolean;
  tiene_receta: boolean;
  stock_actual: number;
  se_vende: boolean;
  producto_activo: boolean;
  imagen_url: string | null;
  costo_promedio: number;
  unidad_medida_id: string | null;
  unidad_nombre: string | null;
  unidad_abreviatura: string | null;
}

export interface ComboFaltante {
  nombre: string;
  necesita: number;
  hay: number;
}

export interface ComboComponentEnriched extends ComboComponentRow {
  costo_unitario: number;
  costo_estimado: number;
  disponible: boolean;
  faltantes: ComboFaltante[];
}

export const COMPONENTES_SELECT = `
  SELECT cp.producto_id, cp.cantidad, p.nombre, p.precio,
         p.tiene_stock, p.tiene_receta, p.stock_actual, p.se_vende,
         p.activo AS producto_activo, p.imagen_url, p.costo_promedio,
         p.unidad_medida_id,
         u.nombre AS unidad_nombre, u.abreviatura AS unidad_abreviatura
  FROM combo_productos cp
  JOIN productos p ON p.id = cp.producto_id
  LEFT JOIN unidades_medida u ON u.id = p.unidad_medida_id
  WHERE cp.combo_id = $1 AND cp.tenant_id = $2`;

export const listarComponentesCombo = async ({ tenantId, comboId }: { tenantId: string; comboId: string }) => {
  const { rows } = await query(COMPONENTES_SELECT, [comboId, tenantId]);
  return rows as unknown as ComboComponentRow[];
};

const redondear4 = (n: number) => Math.round(n * 10000) / 10000;

export const enriquecerComponentes = async ({
  tenantId,
  componentes,
}: {
  tenantId: string;
  componentes: ComboComponentRow[];
}): Promise<ComboComponentEnriched[]> => {
  const resultado: ComboComponentEnriched[] = [];

  for (const c of componentes) {
    let costoUnitario = Number(c.costo_promedio) || 0;
    const faltantes: ComboFaltante[] = [];

    if (c.tiene_receta) {
      const { rows: recetasRows } = await query(
        `SELECT r.id, r.rendimiento
         FROM recetas r
         WHERE r.producto_id = $1 AND r.vigente_hasta IS NULL
         LIMIT 1`,
        [c.producto_id]
      );

      if (recetasRows.length > 0) {
        const receta = recetasRows[0] as { id: string; rendimiento: number };
        const rendimiento = Number(receta.rendimiento) || 1;

        const { rows: ingredientes } = await query(
          `SELECT ri.cantidad, ri.unidad_medida_id,
                  ing.costo_promedio, ing.stock_actual, ing.nombre, ing.tiene_stock,
                  ing.unidad_medida_id AS prod_um_id,
                  um_base.factor AS factor_base,
                  um_ing.factor AS factor_ingrediente
           FROM receta_ingredientes ri
           JOIN productos ing ON ing.id = ri.ingrediente_id AND ing.tenant_id = $1
           JOIN unidades_medida um_base ON um_base.id = ing.unidad_medida_id
           JOIN unidades_medida um_ing ON um_ing.id = ri.unidad_medida_id
           WHERE ri.receta_id = $2`,
          [tenantId, receta.id]
        );

        const ingredientesRows = ingredientes as Array<{
          cantidad: number;
          costo_promedio: number;
          stock_actual: number;
          nombre: string;
          tiene_stock: boolean;
          factor_base: number;
          factor_ingrediente: number;
        }>;

        if (costoUnitario === 0 && ingredientesRows.length > 0 && ingredientesRows.every((i) => Number(i.costo_promedio) > 0)) {
          const costoTotal = ingredientesRows.reduce((sum, ing) => {
            const factorConversion = Number(ing.factor_ingrediente) / Number(ing.factor_base);
            const cantidadBase = Number(ing.cantidad) * factorConversion;
            return sum + cantidadBase * Number(ing.costo_promedio);
          }, 0);
          costoUnitario = Math.round((costoTotal / rendimiento) * 100) / 100;
        }

        for (const ing of ingredientesRows) {
          if (!ing.tiene_stock) continue;

          const recetaCantidad = Number(ing.cantidad);
          const recetaFactor = Number(ing.factor_ingrediente);
          const prodFactor = Number(ing.factor_base) || 1;

          const qtyEnUnidadBase = recetaCantidad * recetaFactor;
          const qtyEnStockUnit = prodFactor > 0 ? qtyEnUnidadBase / prodFactor : qtyEnUnidadBase;
          const qtyNecesaria = redondear4((qtyEnStockUnit / rendimiento) * c.cantidad);

          if (Number(ing.stock_actual) < qtyNecesaria) {
            faltantes.push({ nombre: ing.nombre, necesita: qtyNecesaria, hay: Number(ing.stock_actual) });
          }
        }
      }
    } else if (c.tiene_stock && Number(c.stock_actual) < c.cantidad) {
      faltantes.push({ nombre: c.nombre, necesita: c.cantidad, hay: Number(c.stock_actual) });
    }

    resultado.push({
      ...c,
      costo_unitario: costoUnitario,
      costo_estimado: Math.round(costoUnitario * c.cantidad * 100) / 100,
      disponible: faltantes.length === 0,
      faltantes,
    });
  }

  return resultado;
};

export const resumenCombo = (componentes: ComboComponentEnriched[]) => ({
  costo_estimado: Math.round(componentes.reduce((sum, c) => sum + c.costo_estimado, 0) * 100) / 100,
  disponible: componentes.every((c) => c.disponible),
  advertencias: componentes.flatMap((c) =>
    c.faltantes.map((f) => ({
      componente: c.nombre,
      ...(c.tiene_receta ? { ingrediente: f.nombre } : {}),
      necesita: f.necesita,
      hay: f.hay,
    })),
  ),
});
