import { query } from '../../../shared/config/database.js';

export const obtenerReceta = async ({ tenantId, recetaId }: { tenantId: string; recetaId: string }) => {
  const { rows } = await query(
    `SELECT
       r.id, r.producto_id, r.rendimiento, r.instrucciones, r.creado_en,
       p.nombre AS producto_nombre, p.precio, p.imagen_url,
       p.categoria_id, c.nombre AS categoria_nombre
     FROM recetas r
     JOIN productos p ON p.id = r.producto_id AND p.tenant_id = $2
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE r.id = $1 AND r.tenant_id = $2`,
    [recetaId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Receta no encontrada.' };
  }

  const { rows: ingredientes } = await query(
    `SELECT
       ri.id, ri.ingrediente_id, ri.cantidad, ri.unidad_medida_id, ri.preparacion,
       p.nombre AS ingrediente_nombre,
       u.nombre AS unidad_nombre, u.abreviatura AS unidad_abrev, u.categoria AS unidad_categoria,
       p.stock_actual AS ingrediente_stock
     FROM receta_ingredientes ri
     JOIN productos p ON p.id = ri.ingrediente_id
     JOIN unidades_medida u ON u.id = ri.unidad_medida_id
     WHERE ri.receta_id = $1
     ORDER BY ri.creado_en ASC`,
    [recetaId]
  );

  return { ...rows[0], ingredientes };
};
