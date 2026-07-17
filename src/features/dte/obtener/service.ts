import { query } from '../../../shared/config/database.js';
import { obtenerClientePorTenant } from '../../../shared/dte-client.js';

export const obtener = async ({ tenantId, codigoGeneracion }: { tenantId: string; codigoGeneracion: string }) => {
  const { rows } = await query(
    `SELECT * FROM dtes_orden
     WHERE codigo_generacion = $1 AND tenant_id = $2`,
    [codigoGeneracion, tenantId]
  );

  if (rows.length === 0) {
    const cliente = await obtenerClientePorTenant(tenantId);
    const resp = await cliente.get(`/api/dte/${encodeURIComponent(codigoGeneracion)}`);
    return resp;
  }

  return rows[0];
};
