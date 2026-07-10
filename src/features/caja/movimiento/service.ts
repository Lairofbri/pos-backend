import { getClient } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerCajaAbierta, recalcularTotalesCaja } from '../shared.js';

export const registrarMovimiento = async ({ tenantId, usuarioId, datos }: { tenantId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  const { tipo, monto, motivo, sucursal_id } = datos as { tipo: string; monto: number; motivo: string; sucursal_id?: string };
  const caja = await obtenerCajaAbierta({ tenantId, sucursalId: sucursal_id });

  if (!caja) {
    throw { status: 404, mensaje: 'No hay ninguna caja abierta para registrar movimientos.' };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO movimientos_caja
         (caja_id, tenant_id, tipo, monto, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tipo, monto, motivo, creado_en`,
      [caja.id, tenantId, tipo, monto, motivo, usuarioId]
    );

    await recalcularTotalesCaja(client, caja.id as string);

    await client.query('COMMIT');

    logger.info('Movimiento de caja registrado', {
      caja_id: caja.id,
      tipo,
      monto,
      motivo,
    });

    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
