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
 * Alta de un ítem del sidebar. `menus` es un catálogo GLOBAL: el ítem aplica a
 * todas las empresas (el acceso por rol se resuelve con `rol_permisos`).
 * Solo el rol `plataforma` llega hasta aquí (endpoint).
 */
export const crearMenu = async ({ datos }: { datos: Record<string, unknown> }) => {
  if (datos.parent_id) {
    const { rows: parentRows } = await query(
      'SELECT id FROM menus WHERE id = $1',
      [datos.parent_id]
    );
    if (parentRows.length === 0) {
      throw { status: 404, mensaje: 'El menú padre indicado no existe.' };
    }
  }

  const { rows } = await query(
    `INSERT INTO menus (parent_id, titulo, icono, ruta, orden, permiso_codigo, solo_plataforma)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, parent_id, titulo, icono, ruta, orden, permiso_codigo, activo`,
    [
      datos.parent_id || null,
      datos.titulo,
      datos.icono || null,
      datos.ruta || null,
      datos.orden ?? 0,
      datos.permiso_codigo || null,
      datos.solo_plataforma === true,
    ]
  );

  return rows[0] as unknown as MenuRow;
};
