import { query } from '../../../../shared/config/database.js';
import { adjuntarOrdenActiva } from '../../shared.js';

export const listarMesas = async ({ tenantId, soloActivas = true, sucursalId }: { tenantId: string; soloActivas?: boolean; sucursalId?: string }) => {
  const valores: unknown[] = [tenantId];
  let idx = 2;

  const condiciones = [`tenant_id = $1`];
  if (soloActivas) condiciones.push(`activo = TRUE`);
  if (sucursalId) { condiciones.push(`sucursal_id = $${idx++}`); valores.push(sucursalId); }

  const { rows } = await query(
    `SELECT id, numero, nombre, capacidad, estado, activo, sucursal_id
     FROM mesas
     WHERE ${condiciones.join(' AND ')}
     ORDER BY numero ASC`,
    valores
  );

  await adjuntarOrdenActiva(rows, tenantId, sucursalId);
  return rows;
};
