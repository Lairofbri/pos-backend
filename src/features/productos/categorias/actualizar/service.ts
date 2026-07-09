import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { validarCategoriaPadre, calcularNivelCategoria } from '../../shared.js';
import { obtenerCategoria } from '../obtener/service.js';

export const actualizarCategoria = async ({ tenantId, categoriaId, datos }: { tenantId: string; categoriaId: string; datos: Record<string, unknown> }) => {
  await obtenerCategoria({ tenantId, categoriaId });

  if (datos.parent_id !== undefined) {
    if (datos.parent_id === categoriaId) {
      throw { status: 400, mensaje: 'Una categoría no puede ser padre de sí misma.' };
    }
    if (datos.parent_id) {
      await validarCategoriaPadre({ tenantId, parentId: datos.parent_id as string });
      const nivelPadre = await calcularNivelCategoria({ tenantId, categoriaId: datos.parent_id as string });
      if (nivelPadre >= 2) {
        throw { status: 400, mensaje: 'Máximo 3 niveles de categorías. No se pueden crear subcategorías más profundas.' };
      }
    }
  }

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  if (datos.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(datos.nombre); }
  if (datos.descripcion !== undefined) { campos.push(`descripcion = $${idx++}`); valores.push(datos.descripcion); }
  if (datos.parent_id !== undefined) { campos.push(`parent_id = $${idx++}`); valores.push(datos.parent_id); }
  if (datos.orden !== undefined) { campos.push(`orden = $${idx++}`); valores.push(datos.orden); }
  if (datos.icono !== undefined) { campos.push(`icono = $${idx++}`); valores.push(datos.icono); }
  if (datos.color !== undefined) { campos.push(`color = $${idx++}`); valores.push(datos.color); }
  if (datos.activo !== undefined) { campos.push(`activo = $${idx++}`); valores.push(datos.activo); }

  valores.push(categoriaId, tenantId);

  const { rows } = await query(
    `UPDATE categorias SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, parent_id, nombre, descripcion, orden, icono, color, activo`,
    valores
  );

  logger.info('Categoría actualizada', { categoria_id: categoriaId });
  return rows[0];
};
