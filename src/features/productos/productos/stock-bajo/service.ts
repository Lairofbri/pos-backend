import { query } from '../../../../shared/config/database.js';

export const productosStockBajo = async ({ tenantId }: { tenantId: string }) => {
  const { rows } = await query(
    `SELECT id, nombre, stock_actual, stock_minimo, categoria_id
     FROM productos
     WHERE tenant_id = $1
       AND tiene_stock = TRUE
       AND activo = TRUE
       AND stock_actual <= stock_minimo
     ORDER BY stock_actual ASC`,
    [tenantId]
  );
  return rows;
};
