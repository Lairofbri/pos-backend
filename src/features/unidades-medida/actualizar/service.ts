import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';

export const actualizarUnidad = async ({ tenantId, unidadId, datos }: { tenantId: string; unidadId: string; datos: Record<string, unknown> }) => {
  const { rows: existe } = await query(
    'SELECT id FROM unidades_medida WHERE id = $1 AND tenant_id = $2',
    [unidadId, tenantId]
  );

  if (existe.length === 0) {
    throw { status: 404, mensaje: 'Unidad de medida no encontrada.' };
  }

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  for (const campo of ['nombre', 'abreviatura', 'categoria', 'factor']) {
    if (datos[campo] !== undefined) {
      campos.push(`${campo} = $${idx++}`);
      valores.push(datos[campo]);
    }
  }

  if (campos.length === 0) {
    throw { status: 400, mensaje: 'No hay campos para actualizar.' };
  }

  valores.push(unidadId, tenantId);

  const { rows } = await query(
    `UPDATE unidades_medida SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, nombre, abreviatura, categoria, factor, activo`,
    valores
  );

  logger.info('Unidad de medida actualizada', { id: unidadId });
  return rows[0];
};
