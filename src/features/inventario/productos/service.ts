import { query } from '../../../shared/config/database.js';

export const listarProductosInventario = async ({
  tenantId,
  filtros = {},
}: {
  tenantId: string;
  filtros?: {
    categoria_id?: string;
    sucursal_id?: string;
    busqueda?: string;
    stock_bajo?: boolean;
    pagina?: number;
    limite?: number;
  };
}) => {
  const {
    categoria_id,
    sucursal_id,
    busqueda,
    stock_bajo,
    pagina = 1,
    limite = 20,
  } = filtros;

  const condiciones = ['p.tenant_id = $1', 'p.tiene_stock = TRUE', 'p.activo = TRUE'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (categoria_id) {
    condiciones.push(`p.categoria_id = $${idx++}`);
    valores.push(categoria_id);
  }

  if (busqueda) {
    condiciones.push(`p.nombre ILIKE $${idx++}`);
    valores.push(`%${busqueda}%`);
  }

  if (stock_bajo) {
    condiciones.push(`p.stock_actual <= p.stock_minimo`);
  }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       p.id, p.nombre, p.descripcion, p.precio, p.precio_costo, p.costo_promedio,
       p.imagen_url,
       p.tiene_stock, p.stock_actual, p.stock_minimo,
       p.codigo, p.activo, p.orden, p.categoria_id,
       p.se_vende, p.tiene_receta, p.unidad_medida_id, p.creado_en,
       c.nombre AS categoria_nombre,
       u.nombre AS unidad_nombre, u.abreviatura AS unidad_abrev
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id AND c.tenant_id = $1
     LEFT JOIN unidades_medida u ON u.id = p.unidad_medida_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY p.nombre ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total
     FROM productos p
     WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    productos: rows,
    paginacion: {
      total: parseInt((conteo[0] as { total: string }).total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt((conteo[0] as { total: string }).total) / limite),
    },
  };
};
