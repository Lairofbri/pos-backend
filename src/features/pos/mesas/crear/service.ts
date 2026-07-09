import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';

export const crearMesa = async ({ tenantId, datos }: { tenantId: string; datos: Record<string, unknown> }) => {
  const { numero, nombre, capacidad, zona, sucursal_id } = datos as {
    numero: string;
    nombre?: string;
    capacidad: number;
    zona?: string;
    sucursal_id?: string;
  };

  const { rows } = await query(
    `INSERT INTO mesas (tenant_id, sucursal_id, numero, nombre, capacidad, zona)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, numero, nombre, capacidad, estado, activo, zona`,
    [tenantId, sucursal_id || null, numero, nombre || null, capacidad, zona || 'salon']
  );

  logger.info('Mesa creada', { tenant_id: tenantId, numero });
  return rows[0];
};
