import { query } from '../../../shared/config/database.js';

export const listarRecetas = async ({
  tenantId,
  filtros = {},
}: {
  tenantId: string;
  filtros?: {
    categoria_id?: string;
    busqueda?: string;
    pagina?: number;
    limite?: number;
  };
}) => {
  const { categoria_id, busqueda, pagina = 1, limite = 20 } = filtros;

  const condiciones = ['r.tenant_id = $1'];
  const valores: unknown[] = [tenantId];
  let idx = 2;

  if (categoria_id) {
    condiciones.push(`p.categoria_id = $${idx++}`);
    valores.push(categoria_id);
  }

  if (busqueda && busqueda.trim()) {
    condiciones.push(`p.nombre ILIKE $${idx++}`);
    valores.push(`%${busqueda.trim()}%`);
  }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
        r.id, r.producto_id, r.version, r.rendimiento, r.instrucciones, r.creado_en,
       p.nombre AS producto_nombre, p.precio,
       p.imagen_url, p.categoria_id,
       c.nombre AS categoria_nombre,
       (SELECT COUNT(*) FROM receta_ingredientes ri WHERE ri.receta_id = r.id)::INTEGER AS num_ingredientes
     FROM recetas r
     JOIN productos p ON p.id = r.producto_id AND p.tenant_id = $1
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE r.vigente_hasta IS NULL AND ${condiciones.join(' AND ')}
     ORDER BY p.nombre ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total
     FROM recetas r
     JOIN productos p ON p.id = r.producto_id AND p.tenant_id = $1
      WHERE r.vigente_hasta IS NULL AND ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    recetas: rows,
    paginacion: {
      total: parseInt((conteo[0] as { total: string }).total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt((conteo[0] as { total: string }).total) / limite),
    },
  };
};
