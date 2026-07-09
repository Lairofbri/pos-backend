import { query } from '../../../../shared/config/database.js';

export const obtenerProducto = async ({ tenantId, productoId }: { tenantId: string; productoId: string }) => {
  const { rows } = await query(
    `SELECT
       p.id, p.nombre, p.descripcion, p.precio,
       p.imagen_url, p.tiene_stock, p.stock_actual, p.stock_minimo,
       p.codigo, p.activo, p.orden, p.creado_en,
       p.categoria_id,
       c.nombre AS categoria_nombre,
       c.color AS categoria_color
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [productoId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Producto no encontrado.' };
  }
  return rows[0];
};
