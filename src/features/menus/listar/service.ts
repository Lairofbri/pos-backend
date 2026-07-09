import { query } from '../../../shared/config/database.js';

type MenuRow = {
  id: string;
  parent_id: string | null;
  titulo: string;
  icono: string | null;
  ruta: string | null;
  orden: number;
  children: MenuRow[];
};

export const obtenerMenus = async ({ tenantId, rol, esAdmin }: { tenantId: string; rol: string; esAdmin: boolean }) => {
  const { rows } = await query(
    'SELECT * FROM fn_obtener_menus($1, $2, $3)',
    [rol, tenantId, esAdmin]
  );

  const items = rows as unknown as MenuRow[];
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
