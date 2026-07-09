import { query } from '../../../shared/config/database.js';

type MenuRow = {
  id: string;
  parent_id: string | null;
  titulo: string;
  icono: string | null;
  ruta: string | null;
  orden: number;
  permiso_codigo: string | null;
  activo: boolean;
};

export const obtenerMenu = async ({ tenantId, menuId }: { tenantId: string; menuId: string }) => {
  const { rows } = await query(
    `SELECT id, parent_id, titulo, icono, ruta, orden, permiso_codigo, activo
     FROM menus
     WHERE id = $1 AND tenant_id = $2`,
    [menuId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Menú no encontrado.' };
  }

  return rows[0] as unknown as MenuRow;
};
