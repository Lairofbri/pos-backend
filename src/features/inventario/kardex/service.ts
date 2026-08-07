import { query } from '../../../shared/config/database.js';

interface KardexMovimiento {
  id: string;
  fecha: string;
  tipo: string;
  referencia: string | null;
  cantidad: number;
  costo_unitario: number | null;
  costo_total: number | null;
  stock_anterior: number;
  stock_posterior: number;
  creado_por: string;
  revertido: boolean;
}

interface KardexResponse {
  producto: {
    id: string;
    nombre: string;
    costo_promedio: number;
    stock_actual: number;
    unidad: string;
  };
  movimientos: KardexMovimiento[];
  paginacion: {
    total: number;
    pagina: number;
    limite: number;
    paginas: number;
  };
}

const descripcionTipo: Record<string, string> = {
  compra: 'Compra',
  ajuste: 'Ajuste',
  merma: 'Merma',
  devolucion: 'Devolución',
  consumo: 'Consumo',
};

export const obtenerKardex = async ({
  tenantId,
  productoId,
  filtros = {},
}: {
  tenantId: string;
  productoId: string;
  filtros?: {
    desde?: string;
    hasta?: string;
    pagina?: number;
    limite?: number;
  };
}): Promise<KardexResponse> => {
  const { desde, hasta, pagina = 1, limite = 50 } = filtros;

  const productoData = await query(
    `SELECT p.id, p.nombre, p.costo_promedio, p.stock_actual,
            um.nombre AS unidad_nombre
     FROM productos p
     LEFT JOIN unidades_medida um ON um.id = p.unidad_medida_id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [productoId, tenantId]
  );

  if (productoData.rows.length === 0) {
    throw { status: 404, mensaje: 'Producto no encontrado.' };
  }

  const prod = productoData.rows[0] as Record<string, unknown>;

  const condiciones = ['m.producto_id = $1', 'm.tenant_id = $2'];
  const valoresConteo: unknown[] = [productoId, tenantId];
  const valores: unknown[] = [productoId, tenantId];
  let idx = 3;

  if (desde) {
    condiciones.push(`m.creado_en >= $${idx++}`);
    valoresConteo.push(desde);
    valores.push(desde);
  }

  if (hasta) {
    condiciones.push(`m.creado_en <= $${idx++}`);
    valoresConteo.push(hasta);
    valores.push(hasta);
  }

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total FROM movimientos_inventario m WHERE ${condiciones.join(' AND ')}`,
    valoresConteo
  );

  const total = parseInt((conteo[0] as { total: string }).total);
  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       m.id, m.tipo_movimiento, m.cantidad, m.costo_unitario,
       m.stock_anterior, m.stock_posterior, m.motivo, m.referencia_tipo,
       m.referencia_id, m.creado_en, m.movimiento_revertido_id,
       u.nombre AS creado_por_nombre
     FROM movimientos_inventario m
     LEFT JOIN usuarios u ON u.id = m.creado_por
     WHERE ${condiciones.join(' AND ')}
     ORDER BY m.creado_en ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const movimientos: KardexMovimiento[] = (rows as Record<string, unknown>[]).map((m) => {
    const cantidad = parseFloat(m.cantidad as string);
    const costoUnitario = m.costo_unitario != null ? parseFloat(m.costo_unitario as string) : null;

    return {
      id: m.id as string,
      fecha: m.creado_en as string,
      tipo: (descripcionTipo[m.tipo_movimiento as string] || m.tipo_movimiento) as string,
      referencia: m.referencia_tipo
        ? `${m.referencia_tipo}${m.referencia_id ? ' #' + (m.referencia_id as string).slice(0, 8) : ''}`
        : (m.motivo as string) || null,
      cantidad,
      costo_unitario: costoUnitario,
      costo_total: costoUnitario != null ? Math.round(cantidad * costoUnitario * 100) / 100 : null,
      stock_anterior: parseFloat(m.stock_anterior as string),
      stock_posterior: parseFloat(m.stock_posterior as string),
      creado_por: (m.creado_por_nombre as string) || 'Sistema',
      revertido: !!m.movimiento_revertido_id,
    };
  });

  return {
    producto: {
      id: prod.id as string,
      nombre: prod.nombre as string,
      costo_promedio: parseFloat(prod.costo_promedio as string),
      stock_actual: parseFloat(prod.stock_actual as string),
      unidad: (prod.unidad_nombre as string) || 'unidad',
    },
    movimientos,
    paginacion: {
      total,
      pagina,
      limite,
      paginas: Math.ceil(total / limite),
    },
  };
};
