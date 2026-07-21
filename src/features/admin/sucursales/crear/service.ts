import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';

export const crearSucursal = async ({ tenantId, datos }: { tenantId: string; datos: Record<string, unknown> }) => {
  const { nombre, direccion, telefono, es_principal } = datos as {
    nombre: string;
    direccion?: string;
    telefono?: string;
    es_principal?: boolean;
  };

  const { rows } = await query(
    `INSERT INTO sucursales (tenant_id, nombre, direccion, telefono, es_principal)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, tenant_id, nombre, direccion, telefono, es_principal, activo, creado_en`,
    [tenantId, nombre, direccion || null, telefono || null, es_principal || false]
  );

  logger.info('Sucursal creada', { tenant_id: tenantId, nombre });
  return rows[0];
};
