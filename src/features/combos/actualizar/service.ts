import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerCombo } from '../obtener/service.js';

export const actualizarCombo = async ({ tenantId, comboId, datos }: { tenantId: string; comboId: string; datos: Record<string, unknown> }) => {
  await obtenerCombo({ tenantId, comboId });

  const campos: string[] = [];
  const valores: unknown[] = [];
  let idx = 1;

  if (datos.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(datos.nombre); }
  if (datos.precio !== undefined) { campos.push(`precio = $${idx++}`); valores.push(datos.precio); }
  if (datos.activo !== undefined) { campos.push(`activo = $${idx++}`); valores.push(datos.activo); }

  if (campos.length > 0) {
    valores.push(comboId, tenantId);
    await query(
      `UPDATE combos SET ${campos.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}`,
      valores
    );
  }

  if (datos.productos) {
    await query('DELETE FROM combo_productos WHERE combo_id = $1 AND tenant_id = $2', [comboId, tenantId]);

    for (const p of datos.productos as { producto_id: string; cantidad: number }[]) {
      await query(
        `INSERT INTO combo_productos (combo_id, producto_id, cantidad, tenant_id)
         VALUES ($1, $2, $3, $4)`,
        [comboId, p.producto_id, p.cantidad || 1, tenantId]
      );
    }
  }

  logger.info('Combo actualizado', { combo_id: comboId });

  return obtenerCombo({ tenantId, comboId });
};
