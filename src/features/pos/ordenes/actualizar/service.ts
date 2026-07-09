import { getClient } from '../../../../shared/config/database.js';
import { ESTADOS_FINALES } from '../../../../shared/utils/constants.js';
import { obtenerOrdenShared, recalcularOrden } from '../../shared.js';

export const actualizarOrden = async ({ tenantId, ordenId, datos }: { tenantId: string; ordenId: string; datos: Record<string, unknown> }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(orden.estado as string)) {
    throw { status: 400, mensaje: `No se puede modificar una orden en estado "${orden.estado}".` };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const campos: string[] = [];
    const valores: unknown[] = [];
    let idx = 1;

    const d = datos as {
      notas?: string;
      porcentaje_descuento?: number;
      propina_porcentaje?: number;
      propina_monto?: number;
      origen?: string;
      numero_externo?: string;
    };

    if (d.notas !== undefined) { campos.push(`notas = $${idx++}`); valores.push(d.notas); }
    if (d.porcentaje_descuento !== undefined) { campos.push(`porcentaje_descuento = $${idx++}`); valores.push(d.porcentaje_descuento); }
    if (d.propina_porcentaje !== undefined) { campos.push(`propina_porcentaje = $${idx++}`); valores.push(d.propina_porcentaje); }
    if (d.propina_monto !== undefined) { campos.push(`propina_monto = $${idx++}`); valores.push(d.propina_monto); }
    if (d.origen !== undefined) { campos.push(`origen = $${idx++}`); valores.push(d.origen); }
    if (d.numero_externo !== undefined) { campos.push(`numero_externo = $${idx++}`); valores.push(d.numero_externo); }

    if (campos.length > 0) {
      valores.push(ordenId, tenantId);
      await client.query(
        `UPDATE ordenes SET ${campos.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}`,
        valores
      );
    }

    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');
    return totales;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
