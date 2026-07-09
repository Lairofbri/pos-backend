import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { validarCategoriaPadre, calcularNivelCategoria } from '../../shared.js';

export const crearCategoria = async ({ tenantId, datos }: { tenantId: string; datos: Record<string, unknown> }) => {
  const { nombre, descripcion, parent_id, orden, icono, color } = datos as {
    nombre: string;
    descripcion?: string;
    parent_id?: string;
    orden?: number;
    icono?: string;
    color?: string;
  };

  if (parent_id) {
    await validarCategoriaPadre({ tenantId, parentId: parent_id });
    const nivelPadre = await calcularNivelCategoria({ tenantId, categoriaId: parent_id });
    if (nivelPadre >= 2) {
      throw { status: 400, mensaje: 'Máximo 3 niveles de categorías. No se pueden crear subcategorías más profundas.' };
    }
  }

  const { rows } = await query(
    `INSERT INTO categorias (tenant_id, nombre, descripcion, parent_id, orden, icono, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, parent_id, nombre, descripcion, orden, icono, color, activo, creado_en`,
    [tenantId, nombre, descripcion || null, parent_id || null, orden ?? 0, icono || null, color || null]
  );

  logger.info('Categoría creada', { tenant_id: tenantId, nombre, parent_id: parent_id || null });
  return rows[0];
};
