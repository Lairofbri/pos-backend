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

/**
 * Edición de un ítem del catálogo GLOBAL de menús (aplica a todas las
 * empresas). Solo el rol `plataforma` llega hasta aquí (endpoint).
 */
export const actualizarMenu = async ({ menuId, datos }: { menuId: string; datos: Record<string, unknown> }) => {
  const { rows: existentes } = await query(
    'SELECT id FROM menus WHERE id = $1',
    [menuId]
  );
  if (existentes.length === 0) {
    throw { status: 404, mensaje: 'Menú no encontrado.' };
  }

  if (datos.parent_id) {
    if (datos.parent_id === menuId) {
      throw { status: 400, mensaje: 'Un menú no puede ser padre de sí mismo.' };
    }
    const { rows: parentRows } = await query(
      'SELECT id FROM menus WHERE id = $1',
      [datos.parent_id]
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

  valores.push(menuId);
  const { rows } = await query(
    `UPDATE menus SET ${campos.join(', ')}
     WHERE id = $${idx}
     RETURNING id, parent_id, titulo, icono, ruta, orden, permiso_codigo, activo`,
    valores
  );

  return rows[0] as unknown as MenuRow;
};
