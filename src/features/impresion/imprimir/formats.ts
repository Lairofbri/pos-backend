/* eslint-disable @typescript-eslint/no-explicit-any */
import moment from 'moment-timezone';

moment.tz.setDefault('America/El_Salvador');

const CENTRO = (texto: string, ancho: number) => {
  if (texto.length >= ancho) return texto.slice(0, ancho);
  const izq = Math.floor((ancho - texto.length) / 2);
  return ' '.repeat(izq) + texto;
};

const DERECHA = (texto: string, ancho: number) => {
  if (texto.length >= ancho) return texto.slice(0, ancho);
  return ' '.repeat(ancho - texto.length) + texto;
};

const LINEA = (ancho: number) => '─'.repeat(ancho);
const ANCHO = 42;

const formatearMoneda = (n: number) => `$${Number(n || 0).toFixed(2)}`;

const envolver = (texto: unknown, ancho: number) => {
  const valor = String(texto ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!valor) return [];
  const lineas: string[] = [];
  for (let inicio = 0; inicio < valor.length; inicio += ancho) {
    lineas.push(valor.slice(inicio, inicio + ancho));
  }
  return lineas;
};

const direccionDte = (direccion: Record<string, any> | null | undefined) => {
  if (!direccion) return [];
  return envolver([
    direccion.complemento,
    direccion.municipio && `Municipio: ${direccion.municipio}`,
    direccion.departamento && `Depto: ${direccion.departamento}`,
  ].filter(Boolean).join(' | '), ANCHO);
};

export const formatoPreCuenta = ({
  orden, tenant, items,
}: { orden: Record<string, any>; tenant: Record<string, any>; items: Record<string, any>[]; pagos?: Record<string, any>[]; dte?: any }) => {
  const ahora = moment();
  const l: string[] = [];

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

export const formatoTicketConsumo = ({
  orden, tenant, items, pagos,
}: { orden: Record<string, any>; tenant: Record<string, any>; items: Record<string, any>[]; pagos?: Record<string, any>[]; dte?: any }) => {
  const ahora = moment();
  const l: string[] = [];

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

  if (pagos && pagos.length > 0) {
    for (const pago of pagos) {
      const metodoLabel: Record<string, string> = {
        efectivo: 'Efectivo',
        tarjeta: 'Tarjeta',
        tarjeta_debito: 'T.Débito',
        tarjeta_credito: 'T.Crédito',
        mixto: 'Mixto',
        transferencia: 'Transferencia',
        bitcoin: 'Bitcoin',
        monedero_electronico: 'Monedero',
        cheque: 'Cheque',
        tarjeta_empresarial: 'T.Empresarial',
        bonos: 'Bonos',
        vales: 'Vales',
        otro: 'Otro',
      };
      const label = metodoLabel[pago.metodo] || pago.metodo;
      l.push(` ${label}:           ${DERECHA(formatearMoneda(pago.total_pagado), 16)}`);
      if (Number(pago.vuelto) > 0) {
        l.push(` Vuelto:               ${DERECHA(formatearMoneda(pago.vuelto), 16)}`);
      }
      if (pago.referencia_tarjeta) l.push(` Ref: ${pago.referencia_tarjeta.slice(0, 20)}`);
      if (pago.referencia_transferencia) l.push(` Ref: ${String(pago.referencia_transferencia).slice(0, 20)}`);
      if (pago.hash_bitcoin) l.push(` Hash: ${String(pago.hash_bitcoin).slice(0, 20)}`);
      if (pago.referencia_cheque) l.push(` Cheque: ${String(pago.referencia_cheque).slice(0, 20)}`);
    }
  }

  l.push('');
  l.push(CENTRO('¡Gracias por su visita!', ANCHO));
  l.push(CENTRO('Consumidor Final', ANCHO));
  if (!orden.cliente_id) l.push(CENTRO('NIT: *** (no proporcionado)', ANCHO));
  l.push('');
  l.push(LINEA(ANCHO));
  l.push('');

  return l.join('\n');
};

export const formatoFactura = ({
  orden, tenant, items, pagos, dte,
}: { orden: Record<string, any>; tenant: Record<string, any>; items: Record<string, any>[]; pagos?: Record<string, any>[]; dte?: any }) => {
  const l: string[] = [];
  const json = dte?.json_dte || dte?.jsonDte || {};
  const identificacion = json.identificacion || {};
  const emisor = json.emisor || {};
  const receptor = json.receptor || {};
  const resumen = json.resumen || {};
  const itemsFiscales = Array.isArray(json.cuerpoDocumento) ? json.cuerpoDocumento : items;
  const tipoDte = identificacion.tipoDte || dte?.tipo_dte || '01';
  const titulo = tipoDte === '03' ? 'COMPROBANTE DE CREDITO FISCAL' : 'FACTURA CONSUMIDOR FINAL';
  const nitEmisor = emisor.nit || tenant.nit;
  const nrcEmisor = emisor.nrc || tenant.nrc;
  const nombreEmisor = emisor.nombre || tenant.nombre || 'AMBER POS';
  const nombreReceptor = receptor.nombre || orden.cliente_nombre || 'Consumidor Final';
  const nitReceptor = receptor.nit || receptor.numDocumento || orden.cliente_nit;
  const nrcReceptor = receptor.nrc || orden.cliente_nrc;
  const totalPagar = Number(resumen.totalPagar ?? orden.total ?? 0);
  const condicionLabels: Record<string, string> = { '1': 'Contado', '2': 'Credito', '3': 'Otro' };
  const pagoLabels: Record<string, string> = {
    '01': 'Efectivo', '02': 'Tarjeta debito', '03': 'Tarjeta credito',
    '04': 'Cheque', '05': 'Transferencia', '09': 'Monedero electronico',
    '10': 'Vale', '11': 'Bitcoin', '99': 'Otro',
  };

  l.push('');
  l.push(CENTRO(nombreEmisor, ANCHO));
  if (emisor.nombreComercial) l.push(CENTRO(emisor.nombreComercial, ANCHO));
  if (emisor.direccion?.complemento) l.push(...direccionDte(emisor.direccion).map((linea) => CENTRO(linea, ANCHO)));
  if (emisor.telefono || tenant.telefono) l.push(CENTRO(`Tel: ${emisor.telefono || tenant.telefono}`, ANCHO));
  if (emisor.correo || tenant.email) l.push(CENTRO(emisor.correo || tenant.email, ANCHO));
  if (nitEmisor) l.push(CENTRO(`NIT: ${nitEmisor}`, ANCHO));
  if (nrcEmisor) l.push(CENTRO(`NRC: ${nrcEmisor}`, ANCHO));
  l.push('');
  l.push(CENTRO('DOCUMENTO TRIBUTARIO ELECTRONICO', ANCHO));
  l.push(CENTRO(titulo, ANCHO));
  l.push(`Version: ${identificacion.version || (tipoDte === '03' ? '4' : '2')}`);
  l.push(`Ambiente: ${identificacion.ambiente === '01' ? 'Produccion' : 'Pruebas'}`);
  l.push('No. Control:');
  l.push(...envolver(identificacion.numeroControl || dte?.numero_control || 'N/D', ANCHO));
  l.push('Codigo Generacion:');
  l.push(...envolver(identificacion.codigoGeneracion || dte?.codigo_generacion || 'N/D', ANCHO));
  l.push('');
  l.push(`Fecha: ${identificacion.fecEmi || moment().format('YYYY-MM-DD')}`);
  l.push(`Hora: ${identificacion.horEmi || moment().format('HH:mm:ss')}`);
  l.push('');
  l.push('RECEPTOR');
  l.push(...envolver(`Nombre: ${nombreReceptor}`, ANCHO));
  if (nitReceptor) l.push(...envolver(`NIT/Doc: ${nitReceptor}`, ANCHO));
  if (nrcReceptor) l.push(...envolver(`NRC: ${nrcReceptor}`, ANCHO));
  if (receptor.direccion) l.push(...direccionDte(receptor.direccion));
  if (receptor.telefono) l.push(`Tel: ${receptor.telefono}`);
  if (receptor.correo) l.push(...envolver(`Correo: ${receptor.correo}`, ANCHO));

  l.push('');
  l.push(LINEA(ANCHO));
  l.push(' Cant Descripcion         P.Unit    Total');
  l.push(LINEA(ANCHO));

  for (const item of itemsFiscales) {
    const cantidad = Number(item.cantidad || 0);
    const precio = Number(item.precioUni ?? item.precio_unitario ?? 0);
    const descuentoItem = Number(item.montoDescu ?? item.descuento ?? 0);
    const base = Number(item.ventaNoSuj || 0) + Number(item.ventaExenta || 0) + Number(item.ventaGravada || 0);
    const totalItem = base > 0 ? base - descuentoItem : Number(item.subtotal_con_descuento || item.subtotal || 0);
    const nombre = item.descripcion || item.nombre_producto || item.nombre || '';
    const descripcion = envolver(nombre, 18);
    l.push(` ${String(cantidad).padStart(4)} ${String(descripcion.shift() || '').padEnd(18)} ${DERECHA(formatearMoneda(precio), 8)} ${DERECHA(formatearMoneda(totalItem), 8)}`);
    for (const linea of descripcion) l.push(`       ${linea}`);
    if (descuentoItem > 0) l.push(`       Descuento: ${formatearMoneda(descuentoItem)}`);
  }

  l.push(LINEA(ANCHO));
  const totalNoSuj = Number(resumen.totalNoSuj || 0);
  const totalExenta = Number(resumen.totalExenta || 0);
  const totalGravada = Number(resumen.totalGravada || 0);
  const descuento = Number(resumen.totalDescu ?? orden.descuento ?? 0);
  if (totalNoSuj > 0) l.push(` No sujeto:            ${DERECHA(formatearMoneda(totalNoSuj), 16)}`);
  if (totalExenta > 0) l.push(` Exenta:               ${DERECHA(formatearMoneda(totalExenta), 16)}`);
  if (totalGravada > 0) l.push(` Gravada:              ${DERECHA(formatearMoneda(totalGravada), 16)}`);
  if (descuento > 0) l.push(` Descuento:            ${DERECHA(formatearMoneda(descuento), 16)}`);
  l.push(` Subtotal:             ${DERECHA(formatearMoneda(resumen.subTotal ?? orden.subtotal), 16)}`);
  for (const tributo of Array.isArray(resumen.tributos) ? resumen.tributos : []) {
    l.push(...envolver(`${tributo.descripcion || 'Tributo'}: ${formatearMoneda(tributo.valor)}`, ANCHO));
  }
  l.push(` TOTAL OPERACION:      ${DERECHA(formatearMoneda(resumen.montoTotalOperacion ?? totalPagar), 16)}`);
  l.push(` TOTAL A PAGAR:        ${DERECHA(formatearMoneda(totalPagar), 16)}`);
  if (resumen.totalLetras) l.push(...envolver(`Son: ${resumen.totalLetras}`, ANCHO));

  l.push('');
  l.push(`Condicion: ${condicionLabels[String(resumen.condicionOperacion)] || 'Contado'}`);
  const pagosDte = Array.isArray(resumen.pagos) ? resumen.pagos : pagos || [];
  for (const pago of pagosDte) {
    const label = pagoLabels[String(pago.codigo)] || pago.metodo || 'Pago';
    const monto = pago.montoPago ?? pago.total_pagado ?? 0;
    l.push(` ${label}: ${DERECHA(formatearMoneda(monto), 25)}`);
  }

  l.push('');
  l.push(CENTRO('SELLO DE RECEPCION HACIENDA', ANCHO));
  l.push(...envolver(dte?.sello_recepcion || dte?.selloRecepcion || 'N/D', ANCHO));
  l.push('');
  l.push(CENTRO('QR DE CONSULTA HACIENDA', ANCHO));
  l.push(CENTRO('Escanee el codigo QR', ANCHO));
  l.push(CENTRO('¡Gracias por su visita!', ANCHO));
  l.push('');
  l.push(LINEA(ANCHO));
  l.push('');

  return l.join('\n');
};
