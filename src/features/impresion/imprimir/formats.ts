/* eslint-disable @typescript-eslint/no-explicit-any */
import moment from 'moment-timezone';

moment.tz.setDefault('America/El_Salvador');

/**
 * Datos comunes que reciben los formatos de ticket. `pagos` y `dte` no se usan
 * en todos los formatos, pero viajan en el mismo objeto para que los tres
 * formatos sean intercambiables desde el handler.
 */
export interface DatosTicket {
  orden: Record<string, any>;
  tenant: Record<string, any>;
  items: Record<string, any>[];
  pagos?: Record<string, any>[];
  dte?: any;
  ancho?: number;
}

/** Ancho de linea (en caracteres) por defecto: papel de 80 mm. */
export const ANCHO_POR_DEFECTO = 42;

/**
 * Resuelve el ancho de linea del ticket.
 * Prioriza `caracteres_x_linea` de la impresora configurada y, si no viene,
 * lo deriva de `papel_mm` (58 mm -> 32, 80 mm -> 42).
 */
export const resolverAncho = (papelMm?: number | null, caracteresXLinea?: number | null) => {
  const caracteres = Number(caracteresXLinea);
  if (Number.isFinite(caracteres) && caracteres > 0) return Math.trunc(caracteres);
  return Number(papelMm) === 58 ? 32 : ANCHO_POR_DEFECTO;
};

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

const normalizar = (texto: unknown) => String(texto ?? '').trim().toLowerCase();

/** Envuelve respetando palabras (y corta palabras más largas que el ancho). */
const envolverPalabras = (texto: unknown, ancho: number) => {
  const valor = String(texto ?? '').replace(/[\r\n]+/g, ' ').trim();
  if (!valor) return [];
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of valor.split(/\s+/)) {
    let resto = palabra;
    while (resto.length > ancho) {
      if (actual) { lineas.push(actual); actual = ''; }
      lineas.push(resto.slice(0, ancho));
      resto = resto.slice(ancho);
    }
    const candidato = actual ? `${actual} ${resto}` : resto;
    if (candidato.length <= ancho) actual = candidato;
    else { lineas.push(actual); actual = resto; }
  }
  if (actual) lineas.push(actual);
  return lineas;
};

const direccionDte = (direccion: Record<string, any> | null | undefined, ancho: number) => {
  if (!direccion) return [];
  return envolver([
    direccion.complemento,
    direccion.municipio && `Municipio: ${direccion.municipio}`,
    direccion.departamento && `Depto: ${direccion.departamento}`,
  ].filter(Boolean).join(' | '), ancho);
};

/** Fila "Etiqueta ....... $monto" que nunca excede el ancho del ticket. */
const filaMonto = (etiqueta: string, monto: number, ancho: number, anchoMonto = 16) => {
  const anchoValor = Math.min(anchoMonto, Math.max(8, ancho - etiqueta.length - 1));
  const relleno = ' '.repeat(Math.max(1, ancho - etiqueta.length - anchoValor));
  return `${etiqueta}${relleno}${DERECHA(formatearMoneda(monto), anchoValor)}`;
};

/** Columnas de la tabla de items de tickets (pre-cuenta y consumo). */
const columnasItems = (ancho: number) => {
  const anchoDesc = Math.max(8, ancho - 17);
  const titulo = (texto: string) => texto.slice(0, anchoDesc).padEnd(anchoDesc);
  return {
    encabezado: ` Cant ${titulo('Descripcion')} ${'Total'.padStart(10)}`,
    fila: (cantidad: string, descripcion: string, total: string) =>
      ` ${cantidad}   ${descripcion.slice(0, anchoDesc).padEnd(anchoDesc)} ${DERECHA(total, 10)}`,
    nota: (nota: string) => `       (${String(nota ?? '').replace(/[\r\n]+/g, ' ').slice(0, Math.max(4, ancho - 9))})`,
  };
};

/** Columnas de la tabla de items de factura (incluye precio unitario). */
const columnasItemsFiscales = (ancho: number) => {
  const anchoDesc = Math.max(8, ancho - 24);
  return {
    anchoDesc,
    encabezado: ` Cant ${'Descripcion'.slice(0, anchoDesc).padEnd(anchoDesc)} ${'P.Unit'.padStart(8)} ${'Total'.padStart(8)}`,
    fila: (cantidad: string, descripcion: string, precio: string, total: string) =>
      ` ${cantidad.padStart(4)} ${descripcion.slice(0, anchoDesc).padEnd(anchoDesc)} ${DERECHA(precio, 8)} ${DERECHA(total, 8)}`,
    detalle: (texto: string) => `       ${texto.slice(0, Math.max(4, ancho - 7))}`,
  };
};

export const formatoPreCuenta = ({ orden, tenant, items, ancho = ANCHO_POR_DEFECTO }: DatosTicket) => {
  const ANCHO = ancho;
  const ahora = moment();
  const l: string[] = [];
  const columnas = columnasItems(ANCHO);

  l.push('');
  l.push(CENTRO(tenant.nombre || 'AMBER POS', ANCHO));
  if (tenant.direccion) l.push(CENTRO(tenant.direccion, ANCHO));
  if (tenant.telefono) l.push(CENTRO(`Tel: ${tenant.telefono}`, ANCHO));
  if (tenant.nit) l.push(CENTRO(`NIT: ${tenant.nit}`, ANCHO));
  l.push('');
  l.push(CENTRO('*** PRECUENTA ***', ANCHO));
  l.push('');
  l.push(...envolver(`Fecha: ${ahora.format('DD/MM/YYYY  HH:mm')}`, ANCHO));
  l.push(...envolver(`No. Orden: ${orden.numero_orden}   Mesa: ${orden.mesa_numero || 'Mostrador'}`, ANCHO));
  l.push(...envolver(`Mesero: ${orden.usuario_nombre || '-'}`, ANCHO));
  l.push(CENTRO('Estado: Pendiente de pago', ANCHO));
  l.push('');
  l.push(LINEA(ANCHO));
  l.push(columnas.encabezado);
  l.push(LINEA(ANCHO));

  for (const item of items) {
    const nombre = item.nombre_producto || item.nombre || '';
    const totalItem = Number(item.subtotal_con_descuento || item.subtotal || 0);
    const cantStr = String(item.cantidad).padStart(2, ' ');
    const desc = item.descuento_porcentaje > 0 ? ` -${item.descuento_porcentaje}%` : '';
    l.push(columnas.fila(cantStr, nombre + desc, formatearMoneda(totalItem)));
    if (item.notas) l.push(columnas.nota(item.notas));
  }

  l.push(LINEA(ANCHO));
  const descuento = Number(orden.descuento || 0);
  const totalSinPropina = Number(orden.total || 0);
  const propinaMonto = Number(orden.propina_monto || 0);

  l.push(filaMonto(' Subtotal:', Number(orden.subtotal || 0), ANCHO));
  if (descuento > 0) l.push(filaMonto(' Descuento:', -descuento, ANCHO));
  const gravado = Number(orden.gravado || 0);
  const iva = Number(orden.iva || 0);
  l.push(filaMonto(' Gravado:', gravado, ANCHO));
  l.push(filaMonto(' IVA 13%:', iva, ANCHO));
  l.push(filaMonto(' TOTAL:', totalSinPropina, ANCHO));
  if (propinaMonto > 0) l.push(filaMonto(' Propina (opcional):', propinaMonto, ANCHO));

  l.push('');
  for (const linea of envolverPalabras('PRECUENTA — DOCUMENTO NO FISCAL. NO ES COMPROBANTE DE PAGO NI SUSTITUYE AL DTE.', ANCHO)) {
    l.push(CENTRO(linea, ANCHO));
  }
  l.push('');
  l.push(CENTRO('¡Gracias por su visita!', ANCHO));
  l.push('');
  l.push(LINEA(ANCHO));
  l.push('');

  return l.join('\n');
};

export const formatoTicketConsumo = ({ orden, tenant, items, pagos, ancho = ANCHO_POR_DEFECTO }: DatosTicket) => {
  const ANCHO = ancho;
  const ahora = moment();
  const l: string[] = [];
  const columnas = columnasItems(ANCHO);

  l.push('');
  l.push(CENTRO(tenant.nombre || 'AMBER POS', ANCHO));
  if (tenant.direccion) l.push(CENTRO(tenant.direccion, ANCHO));
  if (tenant.telefono) l.push(CENTRO(`Tel: ${tenant.telefono}`, ANCHO));
  if (tenant.nit) l.push(CENTRO(`NIT: ${tenant.nit}`, ANCHO));
  l.push('');
  l.push(CENTRO('*** TICKET DE CONSUMO ***', ANCHO));
  l.push(CENTRO(`No. Ticket: ${String(orden.numero_orden || '').padStart(8, '0')}`, ANCHO));
  l.push('');
  l.push(...envolver(`Fecha: ${ahora.format('DD/MM/YYYY  HH:mm')}`, ANCHO));
  l.push(...envolver(`Mesa: ${orden.mesa_numero || 'Mostrador'}   Mesero: ${orden.usuario_nombre || '-'}`, ANCHO));

  const clienteNombre = orden.cliente_nombre || 'Consumidor Final';
  l.push(...envolver(`Cliente: ${clienteNombre}`, ANCHO));

  l.push('');
  l.push(LINEA(ANCHO));
  l.push(columnas.encabezado);
  l.push(LINEA(ANCHO));

  for (const item of items) {
    const nombre = item.nombre_producto || item.nombre || '';
    const totalItem = Number(item.subtotal_con_descuento || item.subtotal || 0);
    const cantStr = String(item.cantidad).padStart(2, ' ');
    const desc = item.descuento_porcentaje > 0 ? ` -${item.descuento_porcentaje}%` : '';
    l.push(columnas.fila(cantStr, nombre + desc, formatearMoneda(totalItem)));
    if (item.notas) l.push(columnas.nota(item.notas));
  }

  l.push(LINEA(ANCHO));
  const descuento = Number(orden.descuento || 0);
  const totalSinPropina = Number(orden.total || 0);
  const propinaMonto = Number(orden.propina_monto || 0);

  l.push(filaMonto(' Subtotal:', Number(orden.subtotal || 0), ANCHO));
  if (descuento > 0) l.push(filaMonto(' Descuento:', -descuento, ANCHO));
  const gravado = Number(orden.gravado || 0);
  const iva = Number(orden.iva || 0);
  l.push(filaMonto(' Gravado:', gravado, ANCHO));
  l.push(filaMonto(' IVA 13%:', iva, ANCHO));
  l.push(filaMonto(CENTRO('TOTAL', 18), totalSinPropina, ANCHO));
  if (propinaMonto > 0) l.push(filaMonto(' Propina:', propinaMonto, ANCHO));

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
      l.push(filaMonto(` ${label}:`, Number(pago.total_pagado || 0), ANCHO));
      if (Number(pago.vuelto) > 0) {
        l.push(filaMonto(' Vuelto:', Number(pago.vuelto), ANCHO));
      }
      if (pago.referencia_tarjeta) l.push(...envolver(` Ref: ${String(pago.referencia_tarjeta)}`, ANCHO));
      if (pago.referencia_transferencia) l.push(...envolver(` Ref: ${String(pago.referencia_transferencia)}`, ANCHO));
      if (pago.hash_bitcoin) l.push(...envolver(` Hash: ${String(pago.hash_bitcoin)}`, ANCHO));
      if (pago.referencia_cheque) l.push(...envolver(` Cheque: ${String(pago.referencia_cheque)}`, ANCHO));
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

/**
 * Ticket de COCINA (no fiscal, sin precios): lo que necesita la línea de
 * preparación para armar el pedido. Reutiliza `items` (los ya enviados a cocina
 * o los de la orden según los pida el handler) y sus comentarios.
 */
export const formatoCocina = ({ orden, items, ancho = ANCHO_POR_DEFECTO }: DatosTicket) => {
  const ANCHO = ancho;
  const ahora = moment();
  const l: string[] = [];

  l.push('');
  l.push(CENTRO('*** COCINA ***', ANCHO));
  l.push(CENTRO(`No. Orden: ${orden.numero_orden}`, ANCHO));
  l.push('');
  l.push(...envolver(`Fecha: ${ahora.format('DD/MM/YYYY  HH:mm')}`, ANCHO));
  l.push(...envolver(`Mesa: ${orden.mesa_numero || 'Mostrador'}   Mesero: ${orden.usuario_nombre || '-'}`, ANCHO));
  if (orden.notas) l.push(...envolverPalabras(`Notas: ${orden.notas}`, ANCHO));
  l.push('');
  l.push(LINEA(ANCHO));

  for (const item of items) {
    const nombre = item.nombre_producto || item.nombre || '';
    const prefijo = `${String(item.cantidad ?? 0).padStart(2, ' ')} x `;
    const lineasDesc = envolverPalabras(nombre, Math.max(4, ANCHO - prefijo.length));
    l.push(`${prefijo}${lineasDesc.shift() ?? ''}`);
    for (const linea of lineasDesc) l.push(`${' '.repeat(prefijo.length)}${linea}`);
    if (item.notas) {
      for (const nota of envolverPalabras(item.notas, Math.max(4, ANCHO - 4))) l.push(`    ${nota}`);
    }
  }

  l.push(LINEA(ANCHO));
  l.push(CENTRO(`${items.length} ${items.length === 1 ? 'item' : 'items'}`, ANCHO));
  l.push('');
  l.push(LINEA(ANCHO));
  l.push('');

  return l.join('\n');
};

export const formatoFactura = ({ orden, tenant, items, pagos, dte, ancho = ANCHO_POR_DEFECTO }: DatosTicket) => {
  const ANCHO = ancho;
  const l: string[] = [];
  const columnas = columnasItemsFiscales(ANCHO);
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
  if (emisor.direccion?.complemento) l.push(...direccionDte(emisor.direccion, ANCHO).map((linea) => CENTRO(linea, ANCHO)));
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
  if (receptor.direccion) l.push(...direccionDte(receptor.direccion, ANCHO));
  if (receptor.telefono) l.push(...envolver(`Tel: ${receptor.telefono}`, ANCHO));
  if (receptor.correo) l.push(...envolver(`Correo: ${receptor.correo}`, ANCHO));

  l.push('');
  l.push(LINEA(ANCHO));
  l.push(columnas.encabezado);
  l.push(LINEA(ANCHO));

  // Comentarios/extras del POS como sub-detalle NO fiscal de la linea fiscal
  // (spec §6.3: no perder comentarios ni complementos). Se emparejan por
  // (descripcion, precio unitario), que salen de la misma columna del POS; si
  // no hay coincidencia unica, no se imprime nada.
  const notasPorClave = new Map<string, string[]>();
  for (const it of items) {
    if (!it.notas) continue;
    const clave = `${normalizar(it.nombre_producto || it.nombre || '')}|${Number(it.precio_unitario || 0)}`;
    notasPorClave.set(clave, [...(notasPorClave.get(clave) ?? []), String(it.notas)]);
  }

  for (const item of itemsFiscales) {
    const cantidad = Number(item.cantidad || 0);
    const precio = Number(item.precioUni ?? item.precio_unitario ?? 0);
    const descuentoItem = Number(item.montoDescu ?? item.descuento ?? 0);
    const base = Number(item.ventaNoSuj || 0) + Number(item.ventaExenta || 0) + Number(item.ventaGravada || 0);
    const totalItem = base > 0 ? base - descuentoItem : Number(item.subtotal_con_descuento || item.subtotal || 0);
    const nombre = item.descripcion || item.nombre_producto || item.nombre || '';
    const descripcion = envolver(nombre, columnas.anchoDesc);
    l.push(columnas.fila(String(cantidad), descripcion.shift() || '', formatearMoneda(precio), formatearMoneda(totalItem)));
    for (const linea of descripcion) l.push(columnas.detalle(linea));
    if (descuentoItem > 0) l.push(columnas.detalle(`Descuento: ${formatearMoneda(descuentoItem)}`));

    const pendientes = notasPorClave.get(`${normalizar(nombre)}|${precio}`);
    if (pendientes && pendientes.length > 0) l.push(columnas.detalle(pendientes.shift() as string));
  }

  l.push(LINEA(ANCHO));
  const totalNoSuj = Number(resumen.totalNoSuj || 0);
  const totalExenta = Number(resumen.totalExenta || 0);
  const totalGravada = Number(resumen.totalGravada || 0);
  const descuento = Number(resumen.totalDescu ?? orden.descuento ?? 0);
  if (totalNoSuj > 0) l.push(filaMonto(' No sujeto:', totalNoSuj, ANCHO));
  if (totalExenta > 0) l.push(filaMonto(' Exenta:', totalExenta, ANCHO));
  if (totalGravada > 0) l.push(filaMonto(' Gravada:', totalGravada, ANCHO));
  if (descuento > 0) l.push(filaMonto(' Descuento:', descuento, ANCHO));
  l.push(filaMonto(' Subtotal:', Number(resumen.subTotal ?? orden.subtotal ?? 0), ANCHO));
  for (const tributo of Array.isArray(resumen.tributos) ? resumen.tributos : []) {
    l.push(...envolver(`${tributo.descripcion || 'Tributo'}: ${formatearMoneda(tributo.valor)}`, ANCHO));
  }
  l.push(filaMonto(' TOTAL OPERACION:', Number(resumen.montoTotalOperacion ?? totalPagar), ANCHO));
  l.push(filaMonto(' TOTAL A PAGAR:', totalPagar, ANCHO));
  if (resumen.totalLetras) l.push(...envolver(`Son: ${resumen.totalLetras}`, ANCHO));

  l.push('');
  l.push(`Condicion: ${condicionLabels[String(resumen.condicionOperacion)] || 'Contado'}`);
  const pagosDte = Array.isArray(resumen.pagos) ? resumen.pagos : pagos || [];
  for (const pago of pagosDte) {
    const label = pagoLabels[String(pago.codigo)] || pago.metodo || 'Pago';
    const monto = Number(pago.montoPago ?? pago.total_pagado ?? 0);
    l.push(filaMonto(` ${label}:`, monto, ANCHO));
  }

  const sello = dte?.sello_recepcion || dte?.selloRecepcion;
  const qrUrl = dte?.qr_url || dte?.qrUrl;

  l.push('');
  if (sello) {
    l.push(CENTRO('SELLO DE RECEPCION HACIENDA', ANCHO));
    l.push(...envolver(sello, ANCHO));
    l.push('');
  }
  if (qrUrl) {
    l.push(CENTRO('QR DE CONSULTA HACIENDA', ANCHO));
    l.push(CENTRO('Escanee el codigo QR', ANCHO));
    l.push('');
  }
  l.push(CENTRO('¡Gracias por su visita!', ANCHO));
  l.push('');
  l.push(LINEA(ANCHO));
  l.push('');

  return l.join('\n');
};
