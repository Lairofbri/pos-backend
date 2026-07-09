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

export const actualizarMenu = async ({ tenantId, menuId, datos }: { tenantId: string; menuId: string; datos: Record<string, unknown> }) => {
  const { rows: existentes } = await query(
    'SELECT id FROM menus WHERE id = $1 AND tenant_id = $2',
    [menuId, tenantId]
  );
  if (existentes.length === 0) {
    throw { status: 404, mensaje: 'Menú no encontrado.' };
  }

  if (datos.parent_id) {
    if (datos.parent_id === menuId) {
      throw { status: 400, mensaje: 'Un menú no puede ser padre de sí mismo.' };
    }
    const { rows: parentRows } = await query(
      'SELECT id FROM menus WHERE id = $1 AND tenant_id = $2',
      [datos.parent_id, tenantId]
    );
    if (parentRows.length === 0) {
      throw { status: 404, mensaje: 'El menú padre indicado no existe.' };
    }
  }

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  for (const [col, val] of Object.entries(datos)) {
    campos.push(`${col} = $${idx}`);
    valores.push(val);
    idx++;
  }

  valores.push(menuId, tenantId);
  const { rows } = await query(
    `UPDATE menus SET ${campos.join(', ')}
     WHERE id = $${idx} AND tenant_id = $${idx + 1}
     RETURNING id, parent_id, titulo, icono, ruta, orden, permiso_codigo, activo`,
    valores
  );

  return rows[0] as unknown as MenuRow;
};
