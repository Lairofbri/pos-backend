import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';

export const crearUnidad = async ({ tenantId, datos }: { tenantId: string; datos: { nombre: string; abreviatura: string; categoria: string; factor: number } }) => {
  const { rows } = await query(
    `INSERT INTO unidades_medida (tenant_id, nombre, abreviatura, categoria, factor)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, abreviatura, categoria, factor, activo`,
    [tenantId, datos.nombre, datos.abreviatura, datos.categoria, datos.factor]
  );

  logger.info('Unidad de medida creada', { id: (rows[0] as { id: string }).id, nombre: datos.nombre });
  return rows[0];
};
