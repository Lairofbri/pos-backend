import { query } from '../../../../shared/config/database.js';

export const listarProductos = async ({ tenantId, filtros = {} }: { tenantId: string; filtros?: Record<string, unknown> }) => {
  const {
    categoria_id,
    activo,
    busqueda,
    con_stock,
    pagina = 1,
    limite = 50,
  } = filtros as {
    categoria_id?: string;
    activo?: boolean;
    busqueda?: string;
    con_stock?: boolean;
    pagina?: number;
    limite?: number;
  };

  const condiciones = ['p.tenant_id = $1'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (activo !== undefined) {
    condiciones.push(`p.activo = $${idx++}`);
    valores.push(activo);
  }

  let cte = '';
  if (categoria_id) {
    const cteIdx = idx++;
    valores.push(categoria_id);
    cte = `WITH RECURSIVE subcats AS (
      SELECT id FROM categorias WHERE id = $${cteIdx} AND tenant_id = $1
      UNION ALL
      SELECT c.id FROM categorias c JOIN subcats s ON c.parent_id = s.id
    ) `;
    condiciones.push(`p.categoria_id IN (SELECT id FROM subcats)`);
  }

  if (busqueda && busqueda.trim()) {
    condiciones.push(`(p.nombre ILIKE $${idx} OR p.descripcion ILIKE $${idx})`);
    valores.push(`%${busqueda.trim()}%`);
    idx++;
  }

  if (con_stock) {
    condiciones.push(`(p.tiene_stock = FALSE OR p.stock_actual > 0)`);
  }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `${cte}SELECT
       p.id, p.nombre, p.descripcion, p.precio,
       p.imagen_url, p.tiene_stock, p.stock_actual, p.stock_minimo,
       p.codigo, p.activo, p.orden, p.creado_en,
       p.categoria_id,
       c.nombre AS categoria_nombre,
       c.color AS categoria_color
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY c.orden ASC NULLS LAST, p.orden ASC, p.nombre ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `${cte}SELECT COUNT(*) as total
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
