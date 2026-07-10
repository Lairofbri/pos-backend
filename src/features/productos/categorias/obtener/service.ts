import { query } from '../../../../shared/config/database.js';

export const obtenerCategoria = async ({ tenantId, categoriaId }: { tenantId: string; categoriaId: string }) => {
  const { rows } = await query(
    `SELECT c.id, c.parent_id, c.nombre, c.descripcion, c.orden, c.icono, c.color, c.activo, c.creado_en,
            (SELECT jsonb_agg(jsonb_build_object('id', h.id, 'nombre', h.nombre))
             FROM categorias h WHERE h.parent_id = c.id AND h.tenant_id = c.tenant_id
            ) AS hijos,
            (SELECT COUNT(*) FROM categorias h WHERE h.parent_id = c.id AND h.tenant_id = c.tenant_id) AS total_hijos
     FROM categorias c
     WHERE c.id = $1 AND c.tenant_id = $2`,
    [categoriaId, tenantId]
  );
  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Categoría no encontrada.' };
  }

  const categoria = rows[0] as Record<string, unknown>;
  categoria.hijos = (categoria.hijos as unknown[]) || [];
  delete categoria.total_hijos;
  return categoria;
};
