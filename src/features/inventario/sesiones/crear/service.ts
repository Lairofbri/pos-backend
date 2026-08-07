import { query } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';

export const crearSesion = async ({
  tenantId,
  usuarioId,
  sucursalId,
  notas,
}: {
  tenantId: string;
  usuarioId: string;
  sucursalId: string | null;
  notas?: string;
}) => {
  const sucursal = sucursalId;

  const { rows: existentes } = await query(
    `SELECT id FROM inventario_sesiones
     WHERE tenant_id = $1 AND sucursal_id IS NOT DISTINCT FROM $2 AND estado = 'abierta'`,
    [tenantId, sucursal]
  );

  if (existentes.length > 0) {
    throw {
      status: 409,
      mensaje: 'Ya existe una sesión de inventario abierta para esta sucursal. Ciérrala antes de crear una nueva.',
    };
  }

  const { rows: productos } = await query(
    `SELECT id, stock_actual FROM productos
     WHERE tenant_id = $1 AND tiene_stock = TRUE AND activo = TRUE`,
    [tenantId]
  );

  const snapshot: Record<string, number> = {};
  for (const p of productos as { id: string; stock_actual: number }[]) {
    snapshot[p.id] = p.stock_actual;
  }

  const { rows } = await query(
    `INSERT INTO inventario_sesiones (tenant_id, sucursal_id, estado, notas, stock_snapshot, creado_por)
     VALUES ($1, $2, 'abierta', $3, $4, $5)
     RETURNING id, creado_en, stock_snapshot`,
    [tenantId, sucursal, notas || null, JSON.stringify(snapshot), usuarioId]
  );
  const sesion = rows[0] as { id: string; creado_en: string; stock_snapshot: Record<string, number> };

  logger.info('Sesión de inventario creada', {
    sesion_id: sesion.id,
    sucursal_id: sucursal,
    total_productos: Object.keys(snapshot).length,
  });

  return {
    id: sesion.id,
    sucursal_id: sucursal,
    estado: 'abierta' as const,
    notas: notas || null,
    total_productos: Object.keys(snapshot).length,
    stock_snapshot: snapshot,
    creado_en: sesion.creado_en,
  };
};
