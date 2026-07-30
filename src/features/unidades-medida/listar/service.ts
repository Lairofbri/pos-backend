import { query } from '../../../shared/config/database.js';

export const listarUnidades = async ({ tenantId }: { tenantId: string }) => {
  const { rows } = await query(
    `SELECT id, nombre, abreviatura, categoria, factor, activo
     FROM unidades_medida
     WHERE tenant_id = $1
     ORDER BY categoria, factor`,
    [tenantId]
  );
  return rows;
};
