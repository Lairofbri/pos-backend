import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'net';
import { codificarTexto, comandoQR, renderEscpos, PAGINA_CODIGOS } from '../../src/features/impresion/imprimir/escpos.ts';
import { enviarBytesTcp } from '../../src/features/impresion/imprimir/tcp.ts';
import { formatoPreCuenta, formatoTicketConsumo, formatoCocina, formatoFactura } from '../../src/features/impresion/imprimir/formats.ts';

// ── Datos demo (sin BD ni hardware) ─────────────────────────────────────────

const ordenDemo = {
  numero_orden: 1234,
  mesa_numero: 5,
  usuario_nombre: 'Ana Pérez',
  subtotal: 10,
  descuento: 0,
  gravado: 8.85,
  iva: 1.15,
  total: 10,
  propina_monto: 0,
  cliente_nombre: 'Consumidor Final',
};

const itemsDemo = [
  {
    nombre_producto: 'Pupusa de queso revuelta con todo y curtido',
    precio_unitario: 1.25,
    cantidad: 2,
    subtotal: 2.5,
    descuento_porcentaje: 0,
    subtotal_con_descuento: 2.5,
    notas: 'Sin cebolla. + Aguacate',
  },
  { nombre_producto: 'Horchata', precio_unitario: 2, cantidad: 1, subtotal: 2, subtotal_con_descuento: 2 },
];

const tenantDemo = {
  nombre: 'Restaurante Ámbar',
  nit: '0614-010101-101-1',
  direccion: 'Calle Ñ 123',
  telefono: '2222-2222',
};

const dteDemo = {
  tipo_dte: '01',
  numero_control: 'DTE-01-M001P001-000000000000001',
  codigo_generacion: 'ABCD1234-0000-4000-8000-000000000001',
  sello_recepcion: '2026ABCDEF0123456789',
  qr_url: 'https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=ABCD1234-0000-4000-8000-000000000001&fechaEmi=2026-10-14',
  json_dte: {
    identificacion: {
      version: 2,
      ambiente: '01',
      tipoDte: '01',
      numeroControl: 'DTE-01-M001P001-000000000000001',
      codigoGeneracion: 'ABCD1234-0000-4000-8000-000000000001',
      fecEmi: '2026-10-14',
      horEmi: '12:30:00',
    },
    emisor: {
      nombre: 'Restaurante Ámbar S.A. de C.V.',
      nombreComercial: 'Ámbar',
      nit: '0614-010101-101-1',
      nrc: '123456-7',
      direccion: { complemento: 'Calle Ñ 123' },
    },
    receptor: { nombre: 'Consumidor Final' },
    resumen: {
      totalNoSuj: 0,
      totalExenta: 0,
      totalGravada: 8.85,
      subTotal: 8.85,
      montoTotalOperacion: 10,
      totalPagar: 10,
      totalLetras: 'DIEZ 00/100 DOLARES',
      condicionOperacion: 1,
      tributos: [{ descripcion: 'IVA 13%', valor: 1.15 }],
      pagos: [{ codigo: '01', montoPago: 10 }],
    },
    cuerpoDocumento: [
      { cantidad: 2, descripcion: 'Pupusa de queso revuelta con todo y curtido', precioUni: 1.25, ventaGravada: 2.5, montoDescu: 0 },
      { cantidad: 1, descripcion: 'Horchata', precioUni: 2, ventaGravada: 2, montoDescu: 0 },
    ],
  },
};

const lineas = (texto: string) => texto.split('\n');

/** Extrae los datos almacenados en el comando QR (`GS ( k` fn 180). */
const extraerDatosQr = (buf: Buffer): Buffer | null => {
  for (let i = 0; i < buf.length - 7; i++) {
    if (buf[i] !== 0x1d || buf[i + 1] !== 0x28 || buf[i + 2] !== 0x6b) continue;
    if (buf[i + 5] !== 0x31 || buf[i + 6] !== 0x50 || buf[i + 7] !== 0x30) continue;
    const largo = buf[i + 3] | (buf[i + 4] << 8);
    return buf.subarray(i + 8, i + 8 + largo - 3);
  }
  return null;
};

// ── Página de códigos ───────────────────────────────────────────────────────

test('codifica acentos, ñ/Ñ y dibujo de caja a bytes de la página de códigos', () => {
  assert.deepEqual([...codificarTexto('áéíóú')], [0xa0, 0x82, 0xa1, 0xa2, 0xa3]);
  assert.deepEqual([...codificarTexto('ñÑ¿¡°')], [0xa4, 0xa5, 0xa8, 0xad, 0xf8]);
  assert.deepEqual([...codificarTexto('─═╔╗╝║')], [0xc4, 0xcd, 0xc9, 0xbb, 0xbc, 0xba]);
  assert.deepEqual([...codificarTexto('AZaz 09\n')], [0x41, 0x5a, 0x61, 0x7a, 0x20, 0x30, 0x39, 0x0a]);
});

test('translitera tipográficos y reemplaza lo no imprimible sin emitir bytes inválidos', () => {
  // El em dash de la leyenda de precuenta se imprime como '-'
  assert.deepEqual([...codificarTexto('A—B')], [0x41, 0x2d, 0x42]);
  assert.deepEqual([...codificarTexto('x…y')], [0x78, 0x2e, 0x2e, 0x2e, 0x79]);
  assert.deepEqual([...codificarTexto('日本語')], [0x3f, 0x3f, 0x3f]);
});

// ── QR nativo ───────────────────────────────────────────────────────────────

test('el QR usa GS ( k modelo 2, ECC M, tamaño de módulo y la URL auténtica', () => {
  const url = dteDemo.qr_url;
  const qr = comandoQR(url);

  assert.ok(qr.includes(Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00])), 'modelo 2');
  assert.ok(qr.includes(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05])), 'tamaño de módulo 5');
  assert.ok(qr.includes(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31])), 'corrección M');
  assert.ok(qr.subarray(qr.length - 8).equals(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])), 'imprimir');

  const datos = extraerDatosQr(qr);
  assert.ok(datos, 'el comando almacena datos');
  assert.equal(datos.toString('latin1'), url, 'los datos son la URL fiscal, sin transformar');
});

test('el QR se almacena con longitudes y secuencia correctas (GS ( k, cn=49, fn=80)', () => {
  const url = dteDemo.qr_url;
  const qr = comandoQR(url);
  const datos = codificarTexto(url);

  // El comando de almacenamiento declara pL/pH = largo de datos + "1P0".
  const largoEsperado = datos.length + 3;
  const almacenar = Buffer.from([
    0x1d, 0x28, 0x6b,
    largoEsperado & 0xff, (largoEsperado >> 8) & 0xff,
    0x31, 0x50, 0x30,
  ]);
  assert.ok(qr.includes(almacenar), 'cabecera de almacenamiento con pL/pH correctos');

  // Los datos van inmediatamente después de la cabecera y son la URL tal cual.
  const inicio = qr.indexOf(almacenar) + almacenar.length;
  assert.equal(qr.subarray(inicio, inicio + datos.length).toString('latin1'), url);

  // La secuencia respeta el orden del firmware: modelo -> tamaño -> ECC -> datos -> imprimir.
  const posModelo = qr.indexOf(Buffer.from([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41]));
  const posTamano = qr.indexOf(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43]));
  const posEcc = qr.indexOf(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45]));
  const posDatos = qr.indexOf(almacenar);
  const posImprimir = qr.indexOf(Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]));
  assert.ok(posModelo < posTamano && posTamano < posEcc && posEcc < posDatos && posDatos < posImprimir);
  assert.equal(posImprimir + 8, qr.length, 'el QR termina con el comando de impresión');
});

test('renderEscpos abre con ESC @ y cierra con avance y corte GS V', () => {
  const bytes = renderEscpos({ texto: 'Hola', qrUrl: dteDemo.qr_url, lineasAntesDeCorte: 4 });

  assert.deepEqual([...bytes.subarray(0, 2)], [0x1b, 0x40], 'ESC @ al inicio');
  assert.ok(bytes.includes(Buffer.from([0x1b, 0x74, PAGINA_CODIGOS.PC850])), 'selecciona página de códigos');
  assert.ok(extraerDatosQr(bytes), 'incluye el QR');
  assert.ok(bytes.subarray(bytes.length - 3).equals(Buffer.from([0x1d, 0x56, 0x00])), 'termina con corte GS V 0');
  assert.ok(bytes.includes(Buffer.from([0x1b, 0x64, 0x04])), 'avanza antes del corte');
  assert.ok(bytes.includes(Buffer.from('Hola', 'latin1')), 'el texto va en el flujo');
});

test('renderEscpos asegura salto de línea final y admite tickets sin QR', () => {
  const bytes = renderEscpos({ texto: 'Sin QR' });
  assert.equal(extraerDatosQr(bytes), null, 'no emite QR si no hay URL');
  assert.ok(bytes.includes(Buffer.from('Sin QR\n', 'latin1')));
});

// ── Plantillas: ancho y contenido ───────────────────────────────────────────

test('las plantillas respetan el ancho de papel configurado (58 mm=32 y 80 mm=42)', () => {
  for (const ancho of [32, 42]) {
    const textos = [
      formatoPreCuenta({ orden: ordenDemo, tenant: tenantDemo, items: itemsDemo, ancho }),
      formatoTicketConsumo({ orden: ordenDemo, tenant: tenantDemo, items: itemsDemo, ancho }),
      formatoCocina({ orden: ordenDemo, items: itemsDemo, ancho }),
      formatoFactura({ orden: ordenDemo, tenant: tenantDemo, items: itemsDemo, dte: dteDemo, ancho }),
    ];
    for (const texto of textos) {
      for (const linea of lineas(texto)) {
        assert.ok(linea.length <= ancho, `ancho ${ancho}: linea de ${linea.length} → "${linea}"`);
      }
    }
  }
});

test('la precuenta es no fiscal: leyenda obligatoria, estado pendiente y sin datos del DTE', () => {
  const texto = formatoPreCuenta({ orden: ordenDemo, tenant: tenantDemo, items: itemsDemo, ancho: 42 });
  const sinEspacios = (valor: string) => valor.replace(/\s+/g, '');

  assert.ok(
    sinEspacios(texto).includes(sinEspacios('PRECUENTA — DOCUMENTO NO FISCAL. NO ES COMPROBANTE DE PAGO NI SUSTITUYE AL DTE.')),
    'leyenda obligatoria (aunque se ajuste en varias líneas)'
  );
  assert.ok(texto.includes('Pendiente de pago'));
  assert.ok(texto.includes('Sin cebolla. + Aguacate'), 'conserva comentarios/extras del POS');
  for (const fiscal of ['Sello', 'Codigo Generacion', 'No. Control', 'QR DE CONSULTA', dteDemo.numero_control]) {
    assert.ok(!texto.includes(fiscal), `la precuenta no debe contener "${fiscal}"`);
  }
});

test('la precuenta muestra la propina sugerida separada y marcada como opcional', () => {
  const texto = formatoPreCuenta({ orden: { ...ordenDemo, propina_monto: 1 }, tenant: tenantDemo, items: itemsDemo, ancho: 42 });
  assert.ok(texto.includes('Propina (opcional):'));
});

test('la factura usa los datos del DTE, QR, sello y no imprime marcadores vacíos', () => {
  const texto = formatoFactura({ orden: ordenDemo, tenant: tenantDemo, items: itemsDemo, dte: dteDemo, ancho: 42 });

  assert.ok(texto.includes('DOCUMENTO TRIBUTARIO ELECTRONICO'));
  assert.ok(texto.includes(dteDemo.numero_control));
  assert.ok(texto.includes(dteDemo.codigo_generacion));
  assert.ok(texto.includes(dteDemo.sello_recepcion));
  assert.ok(texto.includes('QR DE CONSULTA HACIENDA'));
  assert.ok(texto.includes('Sin cebolla. + Aguacate'), 'sub-detalle no fiscal de la línea');
  assert.ok(!texto.includes('N/D'), 'no imprime marcadores de ejemplo');
});

test('la factura imprime descuentos, no sujeta/exenta y el IVA del FCF sin recalcular', () => {
  const dteConDescuento = {
    ...dteDemo,
    json_dte: {
      ...dteDemo.json_dte,
      resumen: {
        totalNoSuj: 1.5,
        totalExenta: 2,
        totalGravada: 10,
        totalDescu: 1.5,
        subTotal: 12,
        montoTotalOperacion: 12,
        totalPagar: 12,
        totalIva: 1.15,
        totalLetras: 'DOCE 00/100 DOLARES',
        condicionOperacion: 1,
        tributos: null,
        pagos: [{ codigo: '01', montoPago: 12 }],
      },
      cuerpoDocumento: [
        { cantidad: 1, descripcion: 'Plato exento', ventaExenta: 2, ventaGravada: 0, montoDescu: 0 },
        { cantidad: 1, descripcion: 'Bebida', ventaGravada: 10, ventaNoSuj: 1.5, montoDescu: 1.5 },
      ],
    },
  };

  const texto = formatoFactura({ orden: ordenDemo, tenant: tenantDemo, items: itemsDemo, dte: dteConDescuento, ancho: 42 });

  assert.ok(texto.includes('No sujeto:'), 'declara las operaciones no sujetas');
  assert.ok(texto.includes('Exenta:'), 'declara las operaciones exentas');
  assert.ok(texto.includes('Descuento:'), 'declara el descuento global');
  assert.ok(texto.includes('Gravada (IVA incl.):'), 'el FCF rotula la gravada con IVA incluido');
  assert.ok(texto.includes('Base sin IVA:'), 'muestra la base sin IVA del FCF');
  assert.ok(texto.includes('IVA incluido (13%):'), 'muestra el IVA contenido del FCF');
  for (const linea of lineas(texto)) {
    assert.ok(linea.length <= 42, `linea de ${linea.length}`);
  }
});

test('la factura omite sello y QR cuando el DTE no los aporta', () => {
  const sinSello = { ...dteDemo, sello_recepcion: null, qr_url: null };
  const texto = formatoFactura({ orden: ordenDemo, tenant: tenantDemo, items: itemsDemo, dte: sinSello, ancho: 42 });
  assert.ok(!texto.includes('SELLO DE RECEPCION HACIENDA'));
  assert.ok(!texto.includes('QR DE CONSULTA HACIENDA'));
});

test('el ticket de cocina no es fiscal: sin precios, totales ni datos del DTE', () => {
  const texto = formatoCocina({ orden: ordenDemo, items: itemsDemo, ancho: 42 });

  assert.ok(texto.includes('*** COCINA ***'));
  assert.ok(texto.includes('No. Orden: 1234'));
  assert.ok(texto.includes('Mesa: 5'));
  assert.ok(texto.includes('2 x Pupusa de queso revuelta'), 'cantidad x descripcion');
  assert.ok(texto.includes('Sin cebolla. + Aguacate'), 'conserva comentarios de preparacion');
  assert.ok(texto.includes('2 items'));
  for (const noDeseado of ['$', 'TOTAL', 'IVA', 'Sello', 'QR DE CONSULTA', dteDemo.numero_control]) {
    assert.ok(!texto.includes(noDeseado), `el ticket de cocina no debe contener "${noDeseado}"`);
  }
});

// ── Impresora simulada (servidor TCP local) ────────────────────────────────

test('el transporte TCP entrega exactamente los bytes recibidos (impresora simulada)', async () => {
  const bytes = renderEscpos({ texto: formatoTicketConsumo({ orden: ordenDemo, tenant: tenantDemo, items: itemsDemo, ancho: 42 }), qrUrl: dteDemo.qr_url });

  const recibido = await new Promise<Buffer>((resolve, reject) => {
    const capturados: Buffer[] = [];
    let cerrado = false;
    const terminar = () => {
      if (cerrado) return;
      cerrado = true;
      servidor.close();
      resolve(Buffer.concat(capturados));
    };

    const servidor = net.createServer((socket) => {
      socket.on('data', (trozo) => capturados.push(trozo));
      socket.on('end', terminar);
      socket.on('close', terminar);
      socket.on('error', (err) => (capturados.length > 0 ? terminar() : reject(err)));
    });

    servidor.on('error', reject);
    servidor.listen(0, '127.0.0.1', () => {
      const puerto = (servidor.address() as net.AddressInfo).port;
      enviarBytesTcp({ ip: '127.0.0.1', puerto, bytes }).catch(reject);
    });
  });

  assert.deepEqual([...recibido], [...bytes], 'los bytes llegan sin cambios');
  assert.ok(recibido.subarray(0, 2).equals(Buffer.from([0x1b, 0x40])), 'ESC @ al inicio');
  assert.ok(recibido.subarray(recibido.length - 3).equals(Buffer.from([0x1d, 0x56, 0x00])), 'corte al final');
});
