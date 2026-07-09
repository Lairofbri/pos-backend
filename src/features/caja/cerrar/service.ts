import { query, getClient } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerCajaAbierta } from '../shared.js';

export const cerrarCaja = async ({ tenantId, usuarioId, datos }: { tenantId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  const { monto_final, notas_cierre, sucursal_id } = datos as { monto_final: number; notas_cierre?: string; sucursal_id?: string };
  const caja = await obtenerCajaAbierta({ tenantId, sucursalId: sucursal_id });

  if (!caja) {
    throw { status: 404, mensaje: 'No hay ninguna caja abierta para cerrar.' };
  }

  const diferencia = Number((monto_final - (caja.total_esperado as number)).toFixed(2));

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE cajas SET
         estado            = 'cerrada',
         monto_final       = $1,
         diferencia        = $2,
         notas_cierre      = $3,
         usuario_cierre_id = $4,
         fecha_cierre      = NOW()
       WHERE id = $5
       RETURNING
         id, estado, monto_inicial,
         monto_final,
         notas_cierre, fecha_apertura, fecha_cierre`,
      [monto_final, diferencia, notas_cierre || null, usuarioId, caja.id]
    );

    await client.query('COMMIT');

    logger.info('Caja cerrada', {
      caja_id:        caja.id,
      tenant_id:      tenantId,
      usuario_id:     usuarioId,
      monto_final,
      total_esperado: caja.total_esperado,
      diferencia,
    });

    if (diferencia !== 0) {
      const tipoEvento = diferencia > 0 ? 'sobrante' : 'faltante';
      try {
        await query(
          `INSERT INTO bitacora_caja
             (tenant_id, caja_id, tipo_evento, total_esperado, monto_final, diferencia, usuario_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [tenantId, caja.id, tipoEvento, caja.total_esperado, monto_final, diferencia, usuarioId]
        );
      } catch (errBitacora) {
        logger.error('Error al registrar en bitacora_caja', {
          error: (errBitacora as Error).message,
          caja_id: caja.id,
        });
      }
    }

    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
