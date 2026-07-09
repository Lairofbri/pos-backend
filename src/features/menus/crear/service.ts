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

export const crearMenu = async ({ tenantId, datos }: { tenantId: string; datos: Record<string, unknown> }) => {
  if (datos.parent_id) {
    const { rows: parentRows } = await query(
      'SELECT id FROM menus WHERE id = $1 AND tenant_id = $2',
      [datos.parent_id, tenantId]
    );
    if (parentRows.length === 0) {
      throw { status: 404, mensaje: 'El menú padre indicado no existe.' };
    }
  }

  const { rows } = await query(
    `INSERT INTO menus (tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, parent_id, titulo, icono, ruta, orden, permiso_codigo, activo`,
    [tenantId, datos.parent_id || null, datos.titulo, datos.icono || null, datos.ruta || null, datos.orden ?? 0, datos.permiso_codigo || null]
  );

  return rows[0] as unknown as MenuRow;
};
