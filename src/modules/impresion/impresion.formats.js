// src/modules/impresion/impresion.formats.js
// Plantillas de tickets estilo El Salvador

const moment = require('moment-timezone');
const { TASA_IVA } = require('../../utils/constants');
moment.tz.setDefault('America/El_Salvador');

const CENTRO = (texto, ancho) => {
  if (texto.length >= ancho) return texto.slice(0, ancho);
  const izq = Math.floor((ancho - texto.length) / 2);
  return ' '.repeat(izq) + texto;
};

const DERECHA = (texto, ancho) => {
  if (texto.length >= ancho) return texto.slice(0, ancho);
  return ' '.repeat(ancho - texto.length) + texto;
};

const LINEA = (ancho) => '─'.repeat(ancho);

const formatearMoneda = (n) => `$${Number(n || 0).toFixed(2)}`;

const ANCHO = 42;

/**
 * PRE-CUENTA — se entrega al cliente antes del pago
 * Muestra items, subtotal, IVA desglosado y total
 * NO es comprobante fiscal
 */
const formatoPreCuenta = ({
  orden, tenant, items,
}) => {
  const ahora = moment();
  const l = [];

  l.push('');
  l.push(CENTRO(tenant.nombre || 'AMBER POS', ANCHO));
  if (tenant.direccion) l.push(CENTRO(tenant.direccion, ANCHO));
  if (tenant.telefono) l.push(CENTRO(`Tel: ${tenant.telefono}`, ANCHO));
  if (tenant.nit) l.push(CENTRO(`NIT: ${tenant.nit}`, ANCHO));
  l.push('');
  l.push(CENTRO('*** PRE-CUENTA ***', ANCHO));
  l.push('');
  l.push(`Fecha: ${ahora.format('DD/MM/YYYY  HH:mm')}`);
  l.push(`No. Orden: ${orden.numero_orden}   Mesa: ${orden.mesa_numero || 'Mostrador'}`);
  l.push(`Mesero: ${orden.usuario_nombre || '-'}`);
  l.push('');
  l.push(LINEA(ANCHO));
  l.push(' Cant  Descripcion            Total');
  l.push(LINEA(ANCHO));

  for (const item of items) {
    const nombre = item.nombre_producto || item.nombre || '';
    const totalItem = Number(item.subtotal_con_descuento || item.subtotal || 0);
    const cantStr = String(item.cantidad).padStart(2, ' ');
    const desc = item.descuento_porcentaje > 0 ? ` -${item.descuento_porcentaje}%` : '';
    l.push(` ${cantStr}   ${(nombre + desc).slice(0, 22).padEnd(22)} ${DERECHA(formatearMoneda(totalItem), 10)}`);
    if (item.notas) {
      l.push(`       ${' '.repeat(22)}  (${item.notas.slice(0, 28)})`);
    }
  }

  l.push(LINEA(ANCHO));
  const descuento = Number(orden.descuento || 0);
  const totalSinPropina = Number(orden.total || 0);
  const propinaMonto = Number(orden.propina_monto || 0);
  const totalFinal = totalSinPropina + propinaMonto;

  l.push(` Subtotal:             ${DERECHA(formatearMoneda(orden.subtotal || 0), 16)}`);
  if (descuento > 0) l.push(` Descuento:            ${DERECHA(formatearMoneda(-descuento), 16)}`);
  const gravado = Number(orden.gravado || 0);
  const iva = Number(orden.iva || 0);
  l.push(` Gravado:              ${DERECHA(formatearMoneda(gravado), 16)}`);
  l.push(` IVA 13%:              ${DERECHA(formatearMoneda(iva), 16)}`);
  l.push(` TOTAL:                ${DERECHA(formatearMoneda(totalSinPropina), 16)}`);
  if (propinaMonto > 0) l.push(` Propina:              ${DERECHA(formatearMoneda(propinaMonto), 16)}`);

  l.push('');
  l.push(CENTRO('--- Este documento no es un', ANCHO));
  l.push(CENTRO('--- comprobante fiscal', ANCHO));
  l.push('');
  l.push(CENTRO('¡Gracias por su visita!', ANCHO));
  l.push('');
  l.push(LINEA(ANCHO));
  l.push('');

  return l.join('\n');
};

/**
 * TICKET DE CONSUMO — se entrega al cliente DESPUÉS del pago
 * Incluye forma de pago, vuelto, datos fiscales del negocio
 */
const formatoTicketConsumo = ({
  orden, tenant, items, pagos,
}) => {
  const ahora = moment();
  const l = [];

  l.push('');
  l.push(CENTRO(tenant.nombre || 'AMBER POS', ANCHO));
  if (tenant.direccion) l.push(CENTRO(tenant.direccion, ANCHO));
  if (tenant.telefono) l.push(CENTRO(`Tel: ${tenant.telefono}`, ANCHO));
  if (tenant.nit) l.push(CENTRO(`NIT: ${tenant.nit}`, ANCHO));
  l.push('');
  l.push(CENTRO('*** TICKET DE CONSUMO ***', ANCHO));
  l.push(CENTRO(`No. Ticket: ${String(orden.numero_orden || '').padStart(8, '0')}`, ANCHO));
  l.push('');
  l.push(`Fecha: ${ahora.format('DD/MM/YYYY  HH:mm')}`);
  l.push(`Mesa: ${orden.mesa_numero || 'Mostrador'}   Mesero: ${orden.usuario_nombre || '-'}`);

  const clienteNombre = orden.cliente_nombre || 'Consumidor Final';
  l.push(`Cliente: ${clienteNombre.slice(0, 30)}`);

  l.push('');
  l.push(LINEA(ANCHO));
  l.push(' Cant  Descripcion            Total');
  l.push(LINEA(ANCHO));

  for (const item of items) {
    const nombre = item.nombre_producto || item.nombre || '';
    const totalItem = Number(item.subtotal_con_descuento || item.subtotal || 0);
    const cantStr = String(item.cantidad).padStart(2, ' ');
    const desc = item.descuento_porcentaje > 0 ? ` -${item.descuento_porcentaje}%` : '';
    l.push(` ${cantStr}   ${(nombre + desc).slice(0, 22).padEnd(22)} ${DERECHA(formatearMoneda(totalItem), 10)}`);
    if (item.notas) {
      l.push(`       ${' '.repeat(22)}  (${item.notas.slice(0, 28)})`);
    }
  }

  l.push(LINEA(ANCHO));
  const descuento = Number(orden.descuento || 0);
  const totalSinPropina = Number(orden.total || 0);
  const propinaMonto = Number(orden.propina_monto || 0);
  const totalFinal = totalSinPropina + propinaMonto;

  l.push(` Subtotal:             ${DERECHA(formatearMoneda(orden.subtotal || 0), 16)}`);
  if (descuento > 0) l.push(` Descuento:            ${DERECHA(formatearMoneda(-descuento), 16)}`);
  const gravado = Number(orden.gravado || 0);
  const iva = Number(orden.iva || 0);
  l.push(` Gravado:              ${DERECHA(formatearMoneda(gravado), 16)}`);
  l.push(` IVA 13%:              ${DERECHA(formatearMoneda(iva), 16)}`);
  l.push(`${CENTRO('TOTAL', 18)}          ${DERECHA(formatearMoneda(totalSinPropina), 16)}`);
  if (propinaMonto > 0) l.push(` Propina:              ${DERECHA(formatearMoneda(propinaMonto), 16)}`);

  l.push('');
  l.push(LINEA(ANCHO));

  // Información de pago
  if (pagos && pagos.length > 0) {
    for (const pago of pagos) {
      const metodoLabel = {
        efectivo: 'Efectivo',
        tarjeta: 'Tarjeta',
        mixto: 'Mixto',
      }[pago.metodo] || pago.metodo;

      l.push(` ${metodoLabel}:           ${DERECHA(formatearMoneda(pago.total_pagado), 16)}`);
      if (Number(pago.vuelto) > 0) {
        l.push(` Vuelto:               ${DERECHA(formatearMoneda(pago.vuelto), 16)}`);
      }
      if (pago.referencia_tarjeta) {
        l.push(` Ref: ${pago.referencia_tarjeta.slice(0, 20)}`);
      }
    }
  }

  l.push('');
  l.push(CENTRO('¡Gracias por su visita!', ANCHO));
  l.push(CENTRO('Consumidor Final', ANCHO));
  if (!orden.cliente_id) {
    l.push(CENTRO('NIT: *** (no proporcionado)', ANCHO));
  }
  l.push('');
  l.push(LINEA(ANCHO));
  l.push('');

  return l.join('\n');
};

/**
 * FACTURA / CCF — cuando DTE esté implementado
 * Incluye datos fiscales completos del cliente, número de DTE, QR
 */
const formatoFactura = ({
  orden, tenant, items, pagos, dte,
}) => {
  const ahora = moment();
  const l = [];

  l.push('');
  l.push(CENTRO(tenant.nombre || 'AMBER POS', ANCHO));
  if (tenant.direccion) l.push(CENTRO(tenant.direccion, ANCHO));
  if (tenant.telefono) l.push(CENTRO(`Tel: ${tenant.telefono}`, ANCHO));
  if (tenant.nit) l.push(CENTRO(`NIT: ${tenant.nit}`, ANCHO));
  if (tenant.nrc) l.push(CENTRO(`NRC: ${tenant.nrc}`, ANCHO));
  l.push('');
  l.push(CENTRO('*** DOCUMENTO TRIBUTARIO ELECTRONICO ***', ANCHO));

  const tipoDTE = orden.cliente_nrc ? 'COMPROBANTE DE CREDITO FISCAL' : 'FACTURA';
  l.push(CENTRO(tipoDTE, ANCHO));

  if (dte) {
    l.push(CENTRO(`DTE No. ${dte.numero}`, ANCHO));
    l.push(CENTRO(`Autorizacion: ${dte.autorizacion}`, ANCHO));
  }

  l.push(CENTRO(`No. Ticket: ${String(orden.numero_orden || '').padStart(8, '0')}`, ANCHO));
  l.push('');
  l.push(`Fecha: ${ahora.format('DD/MM/YYYY  HH:mm')}`);
  l.push(`Mesa: ${orden.mesa_numero || 'Mostrador'}   Mesero: ${orden.usuario_nombre || '-'}`);

  const clienteNombre = orden.cliente_nombre || 'Consumidor Final';
  l.push(`Cliente: ${clienteNombre.slice(0, 30)}`);
  if (orden.cliente_nit) l.push(`NIT: ${orden.cliente_nit}`);
  if (orden.cliente_nrc) l.push(`NRC: ${orden.cliente_nrc}`);
  if (orden.cliente_direccion) l.push(`Direccion: ${orden.cliente_direccion.slice(0, 30)}`);

  l.push('');
  l.push(LINEA(ANCHO));
  l.push(' Cant  Descripcion            Total');
  l.push(LINEA(ANCHO));

  for (const item of items) {
    const nombre = item.nombre_producto || item.nombre || '';
    const totalItem = Number(item.subtotal_con_descuento || item.subtotal || 0);
    const cantStr = String(item.cantidad).padStart(2, ' ');
    l.push(` ${cantStr}   ${nombre.slice(0, 22).padEnd(22)} ${DERECHA(formatearMoneda(totalItem), 10)}`);
  }

  l.push(LINEA(ANCHO));
  const descuento = Number(orden.descuento || 0);
  const totalSinPropina = Number(orden.total || 0);
  const propinaMonto = Number(orden.propina_monto || 0);

  l.push(` Subtotal:             ${DERECHA(formatearMoneda(orden.subtotal || 0), 16)}`);
  if (descuento > 0) l.push(` Descuento:            ${DERECHA(formatearMoneda(-descuento), 16)}`);
  const gravado = Number(orden.gravado || 0);
  const iva = Number(orden.iva || 0);
  l.push(` Gravado:              ${DERECHA(formatearMoneda(gravado), 16)}`);
  l.push(` IVA 13%:              ${DERECHA(formatearMoneda(iva), 16)}`);
  l.push(`${CENTRO('TOTAL', 18)}          ${DERECHA(formatearMoneda(totalSinPropina), 16)}`);
  if (propinaMonto > 0) l.push(` Propina (no gravada): ${DERECHA(formatearMoneda(propinaMonto), 16)}`);

  l.push('');
  l.push(LINEA(ANCHO));

  if (pagos && pagos.length > 0) {
    for (const pago of pagos) {
      const metodoLabel = {
        efectivo: 'Efectivo',
        tarjeta: 'Tarjeta',
        mixto: 'Mixto',
      }[pago.metodo] || pago.metodo;
      l.push(` ${metodoLabel}:           ${DERECHA(formatearMoneda(pago.total_pagado), 16)}`);
      if (Number(pago.vuelto) > 0) {
        l.push(` Vuelto:               ${DERECHA(formatearMoneda(pago.vuelto), 16)}`);
      }
    }
  }

  l.push('');
  if (dte && dte.qr) {
    l.push(CENTRO('QR: (adjunto en codigo)', ANCHO));
  }
  l.push(CENTRO('¡Gracias por su visita!', ANCHO));
  l.push('');
  l.push(LINEA(ANCHO));
  l.push('');

  return l.join('\n');
};

module.exports = {
  formatoPreCuenta,
  formatoTicketConsumo,
  formatoFactura,
};
