import { query, getClient } from '../../../../shared/config/database.js';
import { ESTADOS_FINALES } from '../../../../shared/utils/constants.js';
import { obtenerOrdenShared, recalcularOrden } from '../../shared.js';

export const actualizarPropina = async ({ tenantId, ordenId, datos }: { tenantId: string; ordenId: string; datos: Record<string, unknown> }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(orden.estado as string)) {
    throw { status: 400, mensaje: `No se puede modificar la propina de una orden "${orden.estado}".` };
  }

  const { porcentaje, monto = 0 } = datos as { porcentaje: number; monto?: number };

  if (porcentaje > 0) {
    await query(
      'UPDATE ordenes SET propina_porcentaje = $1 WHERE id = $2 AND tenant_id = $3',
      [porcentaje, ordenId, tenantId]
    );

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const totales = await recalcularOrden(client, ordenId, tenantId);
      await client.query('COMMIT');

      return {
        propina_porcentaje: porcentaje,
        propina_monto: totales.propina_monto,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  await query(
    'UPDATE ordenes SET propina_porcentaje = 0, propina_monto = $1 WHERE id = $2 AND tenant_id = $3',
    [monto, ordenId, tenantId]
  );

  return { propina_porcentaje: 0, propina_monto: monto };
};
