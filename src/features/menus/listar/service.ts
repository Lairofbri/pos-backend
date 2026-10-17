import { query } from '../../../shared/config/database.js';

type MenuRow = {
  id: string;
  parent_id: string | null;
  titulo: string;
  icono: string | null;
  ruta: string | null;
  orden: number;
  permiso_codigo?: string | null;
  activo?: boolean;
  children: MenuRow[];
};

const armarArbol = (items: MenuRow[]): MenuRow[] => {
  const mapa: Record<string, MenuRow> = {};

  for (const m of items) {
    m.children = [];
    mapa[m.id] = m;
  }

  const arbol: MenuRow[] = [];
  for (const m of items) {
    if (m.parent_id && mapa[m.parent_id]) {
      mapa[m.parent_id].children.push(m);
    } else if (!m.parent_id) {
      arbol.push(m);
    }
  }

  const limpiar = (items: MenuRow[]): MenuRow[] =>
    items
      .map((item) => {
        const children = item.children ? limpiar(item.children) : [];
        if (!item.ruta && children.length === 0) return null;
        return { ...item, children };
      })
      .filter((x): x is MenuRow => x !== null);

  return limpiar(arbol);
};

/**
 * Sidebar del usuario.
 *
 * `menus` es un catálogo GLOBAL (sin tenant_id) — los ítems no varían por
 * empresa. Lo que varía por tenant son los PERMISOS: `fn_obtener_menus` recibe
 * el tenant y filtra cada ítem contra `rol_permisos` (fn_tiene_permiso).
 *
 * `completo = true` (solo rol plataforma, para el mantenimiento del catálogo)
 * devuelve TODO el catálogo global, activos e inactivos, sin filtrar por rol.
 */
export const obtenerMenus = async ({
  tenantId,
  rol,
  esAdmin,
  completo = false,
}: {
  tenantId: string;
  rol: string;
  esAdmin: boolean;
  completo?: boolean;
}) => {
  const { rows } = completo
    ? await query(
        `SELECT id, parent_id, titulo, icono, ruta, orden, permiso_codigo, activo
         FROM menus
         ORDER BY orden, titulo`
      )
    : await query('SELECT * FROM fn_obtener_menus($1, $2, $3)', [rol, tenantId, esAdmin]);

  return armarArbol(rows as unknown as MenuRow[]);
};
