import { query } from '../../shared/config/database.js';

export const esCategoriaHoja = async ({ tenantId, categoriaId }: { tenantId: string; categoriaId: string }) => {
  const { rows } = await query(
    'SELECT COUNT(*) AS total FROM categorias WHERE parent_id = $1 AND tenant_id = $2',
    [categoriaId, tenantId]
  );
  return parseInt((rows[0] as { total: string }).total) === 0;
};

export const validarCategoriaPadre = async ({ tenantId, parentId }: { tenantId: string; parentId: string }) => {
  const { rows } = await query(
    'SELECT id FROM categorias WHERE id = $1 AND tenant_id = $2',
    [parentId, tenantId]
  );
  if (rows.length === 0) {
    throw { status: 404, mensaje: 'La categoría padre indicada no existe.' };
  }
};

export const calcularNivelCategoria = async ({ tenantId, categoriaId }: { tenantId: string; categoriaId: string }) => {
  const { rows } = await query(
    `WITH RECURSIVE ancestros AS (
       SELECT id, parent_id, 0 AS nivel
       FROM categorias
       WHERE id = $1 AND tenant_id = $2
       UNION ALL
       SELECT c.id, c.parent_id, a.nivel + 1
       FROM categorias c
       JOIN ancestros a ON c.id = a.parent_id
       WHERE c.tenant_id = $2
     )
     SELECT MAX(nivel) AS nivel FROM ancestros`,
    [categoriaId, tenantId]
  );
  return (rows[0] as { nivel: number | null })?.nivel ?? 0;
};
