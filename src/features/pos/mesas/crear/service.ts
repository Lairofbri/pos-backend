import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';

export const crearMesa = async ({ tenantId, datos }: { tenantId: string; datos: Record<string, unknown> }) => {
  const { numero, nombre, capacidad, sucursal_id } = datos as {
    numero: string;
    nombre?: string;
    capacidad: number;
    sucursal_id?: string;
  };

  const { rows } = await query(
    `INSERT INTO mesas (tenant_id, sucursal_id, numero, nombre, capacidad)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, numero, nombre, capacidad, estado, activo`,
    [tenantId, sucursal_id || null, numero, nombre || null, capacidad]
  );

  logger.info('Mesa creada', { tenant_id: tenantId, numero });
  return rows[0];
};
