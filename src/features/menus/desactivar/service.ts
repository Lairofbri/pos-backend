import { query } from '../../../shared/config/database.js';

export const desactivarMenu = async ({ tenantId, menuId }: { tenantId: string; menuId: string }) => {
  const { rows } = await query(
    'SELECT id FROM menus WHERE id = $1 AND tenant_id = $2',
    [menuId, tenantId]
  );
  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Menú no encontrado.' };
  }

  await query(
    'UPDATE menus SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [menuId, tenantId]
  );
};
