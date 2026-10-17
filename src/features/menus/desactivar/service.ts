import { query } from '../../../shared/config/database.js';

/**
 * Desactiva un ítem del catálogo GLOBAL de menús: al ser global, el efecto es
 * para todas las empresas (por eso solo `plataforma` puede hacerlo).
 */
export const desactivarMenu = async ({ menuId }: { menuId: string }) => {
  const { rows } = await query(
    'SELECT id FROM menus WHERE id = $1',
    [menuId]
  );
  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Menú no encontrado.' };
  }

  await query(
    'UPDATE menus SET activo = FALSE WHERE id = $1',
    [menuId]
  );
};
