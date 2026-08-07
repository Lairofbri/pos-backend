import { query } from '../../../shared/config/database.js';

export const obtenerRecetaPorProducto = async ({ tenantId, productoId }: { tenantId: string; productoId: string }) => {
  const { rows } = await query(
    `SELECT id, version FROM recetas
     WHERE producto_id = $1 AND tenant_id = $2
       AND vigente_hasta IS NULL
     ORDER BY version DESC LIMIT 1`,
    [productoId, tenantId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0] as { id: string; version: number };
};
