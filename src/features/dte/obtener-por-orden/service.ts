import { query } from '../../../shared/config/database.js';

export const obtenerPorOrden = async ({ tenantId, ordenId }: { tenantId: string; ordenId: string }) => {
  const { rows } = await query(
    `SELECT * FROM dtes_orden
     WHERE orden_id = $1 AND tenant_id = $2
     ORDER BY creado_en DESC
     LIMIT 1`,
    [ordenId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'No hay DTE asociado a esta orden.' };
  }

  return rows[0];
};
