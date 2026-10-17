// scripts/verificar-impresion-e2e.ts
// Fase F — prueba de extremo a extremo del camino de impresión:
//
//   bytes ESC/POS del backend (pos-backend) → agente local AmberPrint → impresora
//
// No usa la BD ni hardware: arma el ticket de una venta demo con las plantillas
// reales (`formats.ts`) y el codificador real (`escpos.ts`), levanta un socket
// local que hace de impresora y verifica que el agente entregue **byte a byte**
// lo mismo que devuelve el endpoint `GET /impresion/ticket-escpos/:ordenId`.
//
// Requisitos: el agente AmberPrint instalado y corriendo (127.0.0.1:9101).
//   Uso: pnpm verificar:impresion-e2e [--puerto 9101] [--token <token>]
//
// El token se toma de `--token`, de `AMBERPRINT_TOKEN` o del `config.json` del
// agente (`%ProgramData%\AmberPrint\config.json`). Nunca se imprime en pantalla.

import net from 'net';
import fs from 'fs';
import path from 'path';
import { renderEscpos } from '../src/features/impresion/imprimir/escpos.ts';
import { formatoFactura, formatoPreCuenta } from '../src/features/impresion/imprimir/formats.ts';

const args = process.argv.slice(2);
const arg = (nombre: string, porDefecto: string) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : porDefecto;
};

const PUERTO_AGENTE = Number(arg('puerto', '9101'));
const TIMEOUT_MS = Number(arg('timeout', '5000'));

const leerTokenConfig = (): string | null => {
  const ruta = path.join(process.env.ProgramData || 'C:\\ProgramData', 'AmberPrint', 'config.json');
  try {
    // El instalador escribe el JSON con BOM (PowerShell): hay que descartarlo.
    const contenido = fs.readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '');
    const config = JSON.parse(contenido) as { token?: string };
    return config.token || null;
  } catch {
    return null;
  }
};

const token = arg('token', '') || process.env.AMBERPRINT_TOKEN || leerTokenConfig();
if (!token) {
  console.error('✖ No hay token: pasá --token, AMBERPRINT_TOKEN o config.json del agente.');
  process.exit(1);
}

const cabeceras = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

// ── Datos demo (los mismos que usan los tests unitarios) ────────────────────

const ordenDemo = {
  numero_orden: 1234, mesa_numero: 5, usuario_nombre: 'Ana Pérez',
  subtotal: 10, descuento: 0, gravado: 8.85, iva: 1.15, total: 10,
  propina_monto: 1, cliente_nombre: 'Consumidor Final',
};

const itemsDemo = [
  {
    nombre_producto: 'Pupusa de queso revuelta con todo y curtido',
    precio_unitario: 1.25, cantidad: 2, subtotal: 2.5,
    descuento_porcentaje: 0, subtotal_con_descuento: 2.5,
    notas: 'Sin cebolla. + Aguacate',
  },
  { nombre_producto: 'Horchata', precio_unitario: 2, cantidad: 1, subtotal: 2, subtotal_con_descuento: 2 },
];

const tenantDemo = {
  nombre: 'Restaurante Ámbar', nit: '0614-010101-101-1',
  direccion: 'Calle Ñ 123', telefono: '2222-2222',
};

const dteDemo = {
  tipo_dte: '01',
  numero_control: 'DTE-01-M001P001-000000000000001',
  codigo_generacion: 'ABCD1234-0000-4000-8000-000000000001',
  sello_recepcion: '2026ABCDEF0123456789',
  qr_url: 'https://admin.factura.gob.sv/consultaPublica?ambiente=01&codGen=ABCD1234-0000-4000-8000-000000000001&fechaEmi=2026-10-14',
  json_dte: {
    identificacion: { version: 2, ambiente: '01', tipoDte: '01', numeroControl: 'DTE-01-M001P001-000000000000001', codigoGeneracion: 'ABCD1234-0000-4000-8000-000000000001', fecEmi: '2026-10-14', horEmi: '12:30:00' },
    emisor: { nombre: 'Restaurante Ámbar S.A. de C.V.', nombreComercial: 'Ámbar', nit: '0614-010101-101-1', nrc: '123456-7', direccion: { complemento: 'Calle Ñ 123' } },
    receptor: { nombre: 'Consumidor Final' },
    resumen: {
      totalNoSuj: 0, totalExenta: 0, totalGravada: 8.85, subTotal: 8.85,
      montoTotalOperacion: 10, totalPagar: 10, totalIva: 1.15,
      totalLetras: 'DIEZ 00/100 DOLARES', condicionOperacion: 1,
      tributos: null, pagos: [{ codigo: '01', montoPago: 10 }],
    },
    cuerpoDocumento: [
      { cantidad: 2, descripcion: 'Pupusa de queso revuelta con todo y curtido', precioUni: 1.25, ventaGravada: 2.5, montoDescu: 0 },
      { cantidad: 1, descripcion: 'Horchata', precioUni: 2, ventaGravada: 2, montoDescu: 0 },
    ],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

const QR_CMD_IMPRIMIR = Buffer.from([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);

/** Impresora simulada: socket TCP local que captura los bytes que escribe el agente. */
const arrancarImpresoraSimulada = async () => {
  const capturados: Buffer[] = [];
  let cerrado = false;
  let resolver: (bytes: Buffer) => void = () => {};
  const recibido = new Promise<Buffer>((res) => {
    resolver = res;
  });
  let esperado = Number.MAX_SAFE_INTEGER;

  const terminar = () => {
    if (cerrado) return;
    cerrado = true;
    clearTimeout(temporizador);
    servidor.close();
    resolver(Buffer.concat(capturados));
  };

  const servidor = net.createServer((socket) => {
    socket.on('data', (trozo) => {
      capturados.push(trozo);
      if (Buffer.concat(capturados).length >= esperado) terminar();
    });
    socket.on('end', terminar);
    socket.on('close', terminar);
    socket.on('error', terminar);
  });

  await new Promise<void>((res, rej) => {
    servidor.on('error', rej);
    servidor.listen(0, '127.0.0.1', res);
  });
  const temporizador = setTimeout(terminar, TIMEOUT_MS);
  const puerto = (servidor.address() as net.AddressInfo).port;

  return {
    puerto,
    recibido,
    limpiar: terminar,
    esperar: (bytes: number) => {
      esperado = bytes;
    },
  };
};

const enviarAlAgente = async (bytes: Buffer, puertoSimulado: number) => {
  const respuesta = await fetch(`http://127.0.0.1:${PUERTO_AGENTE}/print`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({
      destino: { tipo: 'red', ip: '127.0.0.1', puerto: puertoSimulado },
      escpos_base64: bytes.toString('base64'),
      trabajo: 'e2e-verificacion',
    }),
  });
  const cuerpo = (await respuesta.json()) as { ok?: boolean; codigo?: string; mensaje?: string };
  if (!respuesta.ok || !cuerpo.ok) {
    throw new Error(`el agente rechazó el trabajo (${respuesta.status} ${cuerpo.codigo || ''} ${cuerpo.mensaje || ''})`);
  }
};

// ── Verificación ───────────────────────────────────────────────────────────

const main = async () => {
  const fallos: string[] = [];
  const ok = (mensaje: string) => console.log(`  ✔ ${mensaje}`);
  const falla = (mensaje: string) => {
    fallos.push(mensaje);
    console.log(`  ✖ ${mensaje}`);
  };

  console.log(`\nAgente AmberPrint en 127.0.0.1:${PUERTO_AGENTE}\n`);

  // 1. /health (sin token)
  const salud = await fetch(`http://127.0.0.1:${PUERTO_AGENTE}/health`);
  const cuerpoSalud = (await salud.json()) as { ok?: boolean; version?: string; agente?: string };
  if (salud.ok && cuerpoSalud.ok) ok(`/health → ${cuerpoSalud.agente} ${cuerpoSalud.version}`);
  else falla(`/health respondió ${salud.status}`);

  // 2. /printers sin token → 401 (el agente no confía solo en el origen)
  const sinToken = await fetch(`http://127.0.0.1:${PUERTO_AGENTE}/printers`);
  if (sinToken.status === 401) ok('/printers sin token → 401');
  else falla(`/printers sin token devolvió ${sinToken.status} (se esperaba 401)`);

  // 3. Origen no permitido → 403
  const origenAjeno = await fetch(`http://127.0.0.1:${PUERTO_AGENTE}/printers`, {
    headers: { ...cabeceras, Origin: 'https://sitio-no-autorizado.example' },
  });
  if (origenAjeno.status === 403) ok('/printers con origen no permitido → 403');
  else falla(`origen ajeno devolvió ${origenAjeno.status} (se esperaba 403)`);

  // 4. Bytes del backend entregados byte a byte por el agente
  const casos: Array<{ nombre: string; bytes: Buffer }> = [
    {
      nombre: 'factura fiscal (FCF) con QR',
      bytes: renderEscpos({
        texto: formatoFactura({ orden: ordenDemo, tenant: tenantDemo, items: itemsDemo, dte: dteDemo, ancho: 42 }),
        qrUrl: dteDemo.qr_url,
      }),
    },
    {
      nombre: 'precuenta no fiscal (sin QR)',
      bytes: renderEscpos({
        texto: formatoPreCuenta({ orden: ordenDemo, tenant: tenantDemo, items: itemsDemo, ancho: 32 }),
      }),
    },
  ];

  for (const caso of casos) {
    try {
      const simulador = await arrancarImpresoraSimulada();
      simulador.esperar(caso.bytes.length);
      await enviarAlAgente(caso.bytes, simulador.puerto);
      const recibido = await simulador.recibido;
      simulador.limpiar();
      if (Buffer.compare(recibido, caso.bytes) === 0) ok(`${caso.nombre}: ${caso.bytes.length} bytes idénticos`);
      else falla(`${caso.nombre}: el agente entregó ${recibido.length} bytes distintos de ${caso.bytes.length}`);
    } catch (err) {
      falla(`${caso.nombre}: ${(err as Error).message}`);
    }
  }

  const factura = casos[0].bytes;
  if (factura.subarray(0, 2).equals(Buffer.from([0x1b, 0x40]))) ok('el flujo arranca con ESC @');
  else falla('el flujo no arranca con ESC @');
  if (factura.includes(QR_CMD_IMPRIMIR) && factura.includes(Buffer.from(dteDemo.qr_url, 'latin1'))) ok('incluye el QR nativo con la URL fiscal');
  else falla('no incluye el QR nativo con la URL fiscal');
  if (factura.subarray(-3).equals(Buffer.from([0x1d, 0x56, 0x00]))) ok('termina con corte GS V 0');
  else falla('no termina con corte GS V 0');

  console.log(`\n${fallos.length === 0 ? '✔ E2E OK' : `✖ E2E con ${fallos.length} fallo(s)`}\n`);
  // No usar process.exit(): cerrar sockets y salir abruptamente dispara una
  // aserción de libuv en Windows. El código de salida se fija y el proceso
  // termina cuando se liberan los handles.
  process.exitCode = fallos.length === 0 ? 0 : 1;
};

main().catch((err) => {
  console.error(`✖ ${(err as Error).message}`);
  process.exitCode = 1;
});
