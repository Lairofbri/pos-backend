import { getClient } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { obtenerCajaAbierta } from '../shared.js';

export const abrirCaja = async ({ tenantId, usuarioId, datos }: { tenantId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  const { monto_inicial, sucursal_id, notas } = datos as { monto_inicial: number; sucursal_id?: string; notas?: string };

  const cajaAbierta = await obtenerCajaAbierta({ tenantId, sucursalId: sucursal_id });
  if (cajaAbierta) {
    throw {
      status: 409,
      mensaje: `Ya hay una caja abierta desde ${new Date((cajaAbierta.fecha_apertura as string)).toLocaleString('es-SV')}. Ciérrala antes de abrir una nueva.`,
    };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO cajas
         (tenant_id, sucursal_id, usuario_apertura_id, monto_inicial, total_esperado, notas_apertura)
       VALUES ($1, $2, $3, $4, $4, $5)
       RETURNING
         id, tenant_id, sucursal_id, estado,
         monto_inicial, total_esperado,
         total_ventas, total_efectivo, total_tarjeta,
         total_retiros, total_depositos,
         notas_apertura, fecha_apertura, usuario_apertura_id`,
      [tenantId, sucursal_id || null, usuarioId, monto_inicial, notas || null]
    );

    await client.query('COMMIT');

    logger.info('Caja abierta', {
      caja_id: rows[0].id,
      tenant_id: tenantId,
      usuario_id: usuarioId,
      monto_inicial,
    });

    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
