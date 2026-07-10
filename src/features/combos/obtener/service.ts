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

export const obtenerCombo = async ({ tenantId, comboId }: { tenantId: string; comboId: string }) => {
  const { rows } = await query(
    'SELECT id, nombre, precio, activo, creado_en FROM combos WHERE id = $1 AND tenant_id = $2',
    [comboId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Combo no encontrado.' };
  }

  const combo = rows[0] as unknown as ComboRow;
  const { rows: productos } = await query(
    `SELECT cp.producto_id, cp.cantidad, p.nombre, p.precio
     FROM combo_productos cp
     JOIN productos p ON p.id = cp.producto_id
     WHERE cp.combo_id = $1 AND cp.tenant_id = $2`,
    [combo.id, tenantId]
  );
  (combo as Record<string, unknown>).productos = productos as unknown as ProductoRow[];

  return combo;
};
