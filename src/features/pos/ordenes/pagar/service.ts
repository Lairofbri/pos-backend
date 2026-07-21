import { getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { obtenerOrdenShared } from '../../shared.js';
import { io } from '../../../../server.js';

const obtenerMontoMetodo = (datos: Record<string, unknown>, metodo: string): number => {
  const mapa: Record<string, string> = {
    efectivo: 'monto_efectivo',
    tarjeta: 'monto_tarjeta',
    tarjeta_debito: 'monto_tarjeta',
    tarjeta_credito: 'monto_tarjeta',
    transferencia: 'monto_transferencia',
    bitcoin: 'monto_bitcoin',
    monedero_electronico: 'monto_monedero',
    cheque: 'monto_cheque',
    tarjeta_empresarial: 'monto_tarjeta',
    bonos: 'monto_bonos',
    vales: 'monto_vales',
    otro: 'monto_otro',
  };
  const campo = mapa[metodo];
  if (!campo) return 0;
  return Number(datos[campo]) || 0;
};

export const registrarPago = async ({ tenantId, ordenId, usuarioId, datos }: { tenantId: string; ordenId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  if (orden.estado === 'pagada') {
    throw { status: 409, mensaje: 'Esta orden ya fue pagada.' };
  }
  if (orden.estado === 'cancelada') {
    throw { status: 400, mensaje: 'No se puede pagar una orden cancelada.' };
  }

  const metodo = datos.metodo as string;
  const montoMetodo = obtenerMontoMetodo(datos, metodo);
  const montoEfectivo = Number(datos.monto_efectivo) || 0;
  const montoTarjeta = Number(datos.monto_tarjeta) || 0;
  const referenciaTarjeta = datos.referencia_tarjeta as string | undefined;
  const referenciaTransferencia = datos.referencia_transferencia as string | undefined;
  const bancoEmisor = datos.banco_emisor as string | undefined;
  const hashBitcoin = datos.hash_bitcoin as string | undefined;
  const walletId = datos.wallet_id as string | undefined;
  const referenciaCheque = datos.referencia_cheque as string | undefined;
  const descripcionOtro = datos.descripcion_otro as string | undefined;

  const totalOrden = Number(orden.total) || 0;
  const propina = Number(orden.propina_monto) || 0;
  const montoAPagar = Number((totalOrden + propina).toFixed(2));

  // Calcular total pagado según el método
  let totalPagado = metodo === 'mixto'
    ? montoEfectivo + montoTarjeta
    : montoMetodo;

  totalPagado = Number(totalPagado.toFixed(2));

  if (totalPagado < montoAPagar) {
    throw {
      status: 400,
      mensaje: `El monto pagado ($${totalPagado}) es menor al total a pagar con propina ($${montoAPagar}).`,
    };
  }

  const vuelto = metodo === 'efectivo' || (metodo === 'mixto' && montoEfectivo > 0)
    ? Number((totalPagado - montoAPagar).toFixed(2))
    : 0;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: pagoRows } = await client.query(
      `INSERT INTO pagos
         (orden_id, tenant_id, metodo,
          monto_efectivo, monto_tarjeta,
          monto_transferencia, monto_bitcoin, monto_monedero,
          monto_cheque, monto_tarjeta_empresarial,
          monto_bonos, monto_vales, monto_otro,
          total_pagado, vuelto,
          referencia_tarjeta, referencia_transferencia, banco_emisor,
          hash_bitcoin, wallet_id,
          referencia_cheque, descripcion_otro,
          usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16, $17, $18, $19, $20, $21, $22, $23)
       RETURNING id, metodo, monto_efectivo, monto_tarjeta, total_pagado, vuelto, creado_en`,
      [
        ordenId, tenantId, metodo,
        montoEfectivo, montoTarjeta,
        Number(datos.monto_transferencia) || 0,
        Number(datos.monto_bitcoin) || 0,
        Number(datos.monto_monedero) || 0,
        Number(datos.monto_cheque) || 0,
        Number(datos.monto_tarjeta_empresarial) || 0,
        Number(datos.monto_bonos) || 0,
        Number(datos.monto_vales) || 0,
        Number(datos.monto_otro) || 0,
        totalPagado, vuelto,
        referenciaTarjeta || null,
        referenciaTransferencia || null,
        bancoEmisor || null,
        hashBitcoin || null,
        walletId || null,
        referenciaCheque || null,
        descripcionOtro || null,
        usuarioId,
      ]
    );

    await client.query(
      'UPDATE ordenes SET estado = $1, cerrado_en = NOW() WHERE id = $2',
      ['pagada', ordenId]
    );

    if (orden.mesa_id) {
      await client.query(
        'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
        ['disponible', orden.mesa_id, tenantId]
      );
    }

    await client.query('COMMIT');

    io.to(`tenant:${tenantId}`).emit('cocina:orden-completada', {
      orden_id: ordenId,
      numero_orden: orden.numero_orden,
    });

    logger.info('Pago registrado', {
      orden_id: ordenId,
      metodo,
      total_pagado: totalPagado,
      vuelto,
    });

    return {
      pago: pagoRows[0],
      orden: { ...orden, estado: 'pagada', total: orden.total },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
