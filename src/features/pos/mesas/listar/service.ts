import { query } from '../../../../shared/config/database.js';
import { adjuntarOrdenActiva } from '../../shared.js';

export const listarMesas = async ({ tenantId, soloActivas = true }: { tenantId: string; soloActivas?: boolean }) => {
  const condicion = soloActivas
    ? 'WHERE tenant_id = $1 AND activo = TRUE'
    : 'WHERE tenant_id = $1';

  const { rows } = await query(
    `SELECT id, numero, nombre, capacidad, estado, activo, sucursal_id, zona
     FROM mesas
     ${condicion}
     ORDER BY numero ASC`,
    [tenantId]
  );

  await adjuntarOrdenActiva(rows, tenantId);
  return rows;
};
