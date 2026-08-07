import { query } from '../../../../shared/config/database.js';

export const listarMovimientos = async ({
  tenantId,
  filtros = {},
}: {
  tenantId: string;
  filtros?: {
    producto_id?: string;
    tipo?: string;
    sucursal_id?: string;
    desde?: string;
    hasta?: string;
    pagina?: number;
    limite?: number;
  };
}) => {
  const {
    producto_id,
    tipo,
    sucursal_id,
    desde,
    hasta,
    pagina = 1,
    limite = 20,
  } = filtros;

  const condiciones = ['m.tenant_id = $1'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (producto_id) {
    condiciones.push(`m.producto_id = $${idx++}`);
    valores.push(producto_id);
  }

  if (tipo) {
    condiciones.push(`m.tipo_movimiento = $${idx++}`);
    valores.push(tipo);
  }

  if (sucursal_id) {
    condiciones.push(`m.sucursal_id = $${idx++}`);
    valores.push(sucursal_id);
  }

  if (desde) {
    condiciones.push(`m.creado_en >= $${idx++}`);
    valores.push(desde);
  }

  if (hasta) {
    condiciones.push(`m.creado_en <= $${idx++}`);
    valores.push(hasta);
  }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       m.id, m.producto_id, m.tipo_movimiento, m.cantidad,
       m.stock_anterior, m.stock_posterior, m.motivo,
       m.referencia_tipo, m.referencia_id, m.creado_en,
       m.unidad_medida_id, m.cantidad_input, m.unidad_input_id,
       m.movimiento_revertido_id, m.revertido_en,
       m.costo_unitario,
       un.nombre AS unidad_nombre, un.abreviatura AS unidad_abrev,
       p.nombre AS producto_nombre,
       uu.nombre AS creado_por_nombre,
       s.nombre AS sucursal_nombre
     FROM movimientos_inventario m
     JOIN productos p ON p.id = m.producto_id AND p.tenant_id = $1
     LEFT JOIN unidades_medida un ON un.id = m.unidad_medida_id
     LEFT JOIN usuarios uu ON uu.id = m.creado_por
     LEFT JOIN sucursales s ON s.id = m.sucursal_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY m.creado_en DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total
     FROM movimientos_inventario m
     WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    movimientos: rows,
    paginacion: {
      total: parseInt((conteo[0] as { total: string }).total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt((conteo[0] as { total: string }).total) / limite),
    },
  };
};
