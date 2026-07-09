import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { ESTADOS_FINALES } from '../../../../shared/utils/constants.js';
import { obtenerOrdenShared, obtenerMesaShared } from '../../shared.js';

export const cambiarMesa = async ({ tenantId, ordenId, mesaId }: { tenantId: string; ordenId: string; mesaId: string }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(orden.estado as string)) {
    throw { status: 400, mensaje: `No se puede cambiar de mesa una orden "${orden.estado}".` };
  }

  const mesaDestino = await obtenerMesaShared({ tenantId, mesaId });

  if (!(mesaDestino as { activo: boolean }).activo) {
    throw { status: 400, mensaje: `La mesa "${(mesaDestino as { nombre: string }).nombre}" está inactiva.` };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (orden.mesa_id) {
      await client.query(
        'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
        ['disponible', orden.mesa_id, tenantId]
      );
    }

    await client.query(
      'UPDATE ordenes SET mesa_id = $1 WHERE id = $2 AND tenant_id = $3',
      [mesaId, ordenId, tenantId]
    );

    await client.query(
      'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
      ['ocupada', mesaId, tenantId]
    );

    await client.query('COMMIT');

    logger.info('Mesa cambiada', {
      orden_id: ordenId,
      mesa_anterior: orden.mesa_id as string | null,
      mesa_nueva: mesaId,
    });

    return { orden_id: ordenId, mesa_id: mesaId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
