import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerCombo } from '../obtener/service.js';

export const crearCombo = async ({ tenantId, datos }: { tenantId: string; datos: { nombre: string; precio: number; productos: { producto_id: string; cantidad: number }[] } }) => {
  const { nombre, precio, productos } = datos;

  for (const p of productos) {
    const { rows } = await query(
      'SELECT id FROM productos WHERE id = $1 AND tenant_id = $2',
      [p.producto_id, tenantId]
    );
    if (rows.length === 0) {
      throw { status: 400, mensaje: `Producto ${p.producto_id} no encontrado en este tenant.` };
    }
  }

  const { rows: comboRows } = await query(
    `INSERT INTO combos (tenant_id, nombre, precio)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, precio, activo, creado_en`,
    [tenantId, nombre, precio]
  );

  const combo = (comboRows as unknown as { id: string }[])[0];

  for (const p of productos) {
    await query(
      `INSERT INTO combo_productos (combo_id, producto_id, cantidad, tenant_id)
       VALUES ($1, $2, $3, $4)`,
      [combo.id, p.producto_id, p.cantidad || 1, tenantId]
    );
  }

  logger.info('Combo creado', { combo_id: combo.id, tenant_id: tenantId, nombre });

  return obtenerCombo({ tenantId, comboId: combo.id });
};
