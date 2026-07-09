import { query } from '../../../shared/config/database.js';

type ComboRow = {
  id: string;
  nombre: string;
  precio: number;
  activo: boolean;
  creado_en: string;
};

type ProductoRow = {
  producto_id: string;
  cantidad: number;
  nombre: string;
  precio: number;
};

export const listarCombos = async ({ tenantId, soloActivos = true }: { tenantId: string; soloActivos?: boolean }) => {
  const condicion = soloActivos
    ? 'WHERE c.tenant_id = $1 AND c.activo = TRUE'
    : 'WHERE c.tenant_id = $1';

  const { rows } = await query(
    `SELECT c.id, c.nombre, c.precio, c.activo, c.creado_en
     FROM combos c
     ${condicion}
     ORDER BY c.nombre ASC`,
    [tenantId]
  );

  const combos = rows as unknown as ComboRow[];

  for (const combo of combos) {
    const { rows: productos } = await query(
      `SELECT cp.producto_id, cp.cantidad, p.nombre, p.precio
       FROM combo_productos cp
       JOIN productos p ON p.id = cp.producto_id
       WHERE cp.combo_id = $1 AND cp.tenant_id = $2`,
      [combo.id, tenantId]
    );
    (combo as Record<string, unknown>).productos = productos as unknown as ProductoRow[];
  }

  return combos;
};
