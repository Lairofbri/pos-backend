/**
 * Codificador ESC/POS propio (sin dependencias nuevas).
 *
 * El backend es la fuente de verdad del ticket (decisión D3 del spec): acá se
 * arma el flujo de bytes que el agente local (.NET) escribe **tal cual** a la
 * impresora. El camino TCP del POS sigue existiendo (decisión D4) y ahora
 * reutiliza este mismo codificador.
 *
 * Comandos usados (ESC/POS, familia Epson):
 *   ESC @        inicializar impresora
 *   ESC t n      seleccionar página de códigos
 *   ESC a n      alineación (0 izquierda, 1 centro, 2 derecha)
 *   ESC E n      negrita (0 off, 1 on)
 *   ESC d n      avanzar n líneas
 *   GS  V m      corte de papel (m = 0 corte total)
 *   GS ( k ...   QR nativo (modelo 2, corrección M, tamaño de módulo)
 *
 * El QR lo genera el firmware de la impresora a partir de la URL auténtica de
 * consulta de Hacienda (`dte.qr_url`, que el DTE Service entrega solo si el
 * DTE está `aceptado`); este módulo solo emite los comandos y los datos.
 */

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Páginas de códigos ESC/POS (valor `n` del comando `ESC t n`).
 * PC850 cubre todo el juego que usan los tickets (acentos, `ñ/Ñ`, `¿¡`,
 * dibujo de caja). PC858 es un superconjunto (agrega `€`).
 */
export const PAGINA_CODIGOS = {
  PC437: 0x00,
  PC850: 0x02,
  PC852: 0x12,
  PC858: 0x13,
} as const;

/**
 * Página de códigos por defecto.
 * Verificado offline (iconv-lite) que PC850 codifica sin pérdida todo el juego
 * que imprimen las plantillas. La confirmación **en la impresora real** (3nStar)
 * queda pendiente y se cubre en las pruebas físicas (spec §7.3 / Fase F).
 */
export const PAGINA_CODIGOS_POR_DEFECTO: number = PAGINA_CODIGOS.PC850;

/**
 * Transliteración Unicode -> byte de PC850/PC858.
 * Solo se listan los caracteres por encima de ASCII que pueden aparecer en los
 * tickets; el resto cae al reemplazo `?` (nunca se imprimen bytes inválidos).
 */
const MAPA_PC850: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'å': 0x86, 'ç': 0x87,
  'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c, 'ì': 0x8d, 'Ä': 0x8e, 'Å': 0x8f,
  'É': 0x90, 'æ': 0x91, 'Æ': 0x92, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97,
  'ÿ': 0x98, 'Ö': 0x99, 'Ü': 0x9a, 'ø': 0x9b, '£': 0x9c, 'Ø': 0x9d, '×': 0x9e, 'ƒ': 0x9f,
  'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, 'ª': 0xa6, 'º': 0xa7,
  '¿': 0xa8, '®': 0xa9, '¬': 0xaa, '½': 0xab, '¼': 0xac, '¡': 0xad, '«': 0xae, '»': 0xaf,
  '░': 0xb0, '▒': 0xb1, '▓': 0xb2, '│': 0xb3, '┤': 0xb4, 'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7,
  '©': 0xb8, '╣': 0xb9, '║': 0xba, '╗': 0xbb, '╝': 0xbc, '¢': 0xbd, '¥': 0xbe, '┐': 0xbf,
  '└': 0xc0, '┴': 0xc1, '┬': 0xc2, '├': 0xc3, '─': 0xc4, '┼': 0xc5, 'ã': 0xc6, 'Ã': 0xc7,
  '╚': 0xc8, '╔': 0xc9, '╩': 0xca, '╦': 0xcb, '╠': 0xcc, '═': 0xcd, '╬': 0xce, '¤': 0xcf,
  'ð': 0xd0, 'Ð': 0xd1, 'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4, 'ı': 0xd5, 'Í': 0xd6, 'Î': 0xd7,
  'Ï': 0xd8, '┘': 0xd9, '┌': 0xda, '█': 0xdb, '▄': 0xdc, '¦': 0xdd, 'Ì': 0xde, '▀': 0xdf,
  'Ó': 0xe0, 'ß': 0xe1, 'Ô': 0xe2, 'Ò': 0xe3, 'õ': 0xe4, 'Õ': 0xe5, 'µ': 0xe6, 'þ': 0xe7,
  'Þ': 0xe8, 'Ú': 0xe9, 'Û': 0xea, 'Ù': 0xeb, 'ý': 0xec, 'Ý': 0xed, '¯': 0xee, '´': 0xef,
  '\u00ad': 0xf0, '±': 0xf1, '‗': 0xf2, '¾': 0xf3, '¶': 0xf4, '§': 0xf5, '÷': 0xf6, '¸': 0xf7,
  '°': 0xf8, '¨': 0xf9, '·': 0xfa, '¹': 0xfb, '³': 0xfc, '²': 0xfd, '■': 0xfe,
};

/** Tipográficos comunes que no existen en la página de códigos -> equivalente ASCII. */
const TRANSLITERAR: Record<string, string> = {
  '\u2014': '-', '\u2013': '-', '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"',
  '\u2026': '...', '\u2022': '*', '\u00a0': ' ',
};

const REEMPLAZO = 0x3f; // '?'

/** Convierte el texto de la plantilla a bytes de la página de códigos. */
export const codificarTexto = (texto: string): Buffer => {
  const bytes: number[] = [];

  for (const caracter of String(texto ?? '')) {
    if (caracter === '\n') {
      bytes.push(0x0a);
      continue;
    }
    const codigo = caracter.codePointAt(0) as number;
    if (codigo < 0x80) {
      bytes.push(codigo);
      continue;
    }
    const directo = MAPA_PC850[caracter];
    if (directo !== undefined) {
      bytes.push(directo);
      continue;
    }
    const transliterado = TRANSLITERAR[caracter];
    if (transliterado !== undefined) {
      for (const reemplazo of transliterado) bytes.push(reemplazo.codePointAt(0) as number);
      continue;
    }
    bytes.push(REEMPLAZO);
  }

  return Buffer.from(bytes);
};

// ── Comandos ────────────────────────────────────────────────────────────────

/** ESC @ — inicializa la impresora (limpia buffer y resetea el estado). */
export const iniciar = (): Buffer => Buffer.from([ESC, 0x40]);

/** ESC t n — selecciona la página de códigos. */
export const seleccionarPaginaCodigos = (pagina: number = PAGINA_CODIGOS_POR_DEFECTO): Buffer =>
  Buffer.from([ESC, 0x74, pagina & 0xff]);

/** ESC a n — alineación: 0 izquierda, 1 centro, 2 derecha. */
export const alinear = (alineacion: 'izquierda' | 'centro' | 'derecha' = 'centro'): Buffer => {
  const n = alineacion === 'izquierda' ? 0x00 : alineacion === 'derecha' ? 0x02 : 0x01;
  return Buffer.from([ESC, 0x61, n]);
};

/** ESC E n — negrita on/off. */
export const negrita = (activar = true): Buffer => Buffer.from([ESC, 0x45, activar ? 0x01 : 0x00]);

/** ESC d n — avanza n líneas. */
export const avanzar = (lineas = 1): Buffer => Buffer.from([ESC, 0x64, Math.max(0, lineas) & 0xff]);

/** GS V 0 — corte total de papel. */
export const cortar = (): Buffer => Buffer.from([GS, 0x56, 0x00]);

/**
 * GS ( k — QR nativo.
 * Secuencia: modelo 2 -> tamaño de módulo -> corrección M -> almacenar datos -> imprimir.
 * `cellSize` (1..16) define el tamaño del módulo; 5 da un QR cómodo de escanear.
 */
export const comandoQR = (
  url: string,
  { celda = 5, correccion = 'M' }: { celda?: number; correccion?: 'L' | 'M' | 'Q' | 'H' } = {}
): Buffer => {
  const modelo2 = Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);
  const tamano = Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.min(16, Math.max(1, celda))]);
  const niveles: Record<string, number> = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 };
  const error = Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, niveles[correccion] ?? 0x31]);

  const datos = codificarTexto(url);
  const largoDatos = datos.length + 3; // + "1P0"
  const almacenar = Buffer.from([
    GS, 0x28, 0x6b,
    largoDatos & 0xff, (largoDatos >> 8) & 0xff,
    0x31, 0x50, 0x30,
  ]);
  const imprimir = Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);

  return Buffer.concat([modelo2, tamano, error, almacenar, datos, imprimir]);
};

// ── Render completo ─────────────────────────────────────────────────────────

export type OpcionesRender = {
  /** Texto ya formateado a ancho de papel (plantillas de `formats.ts`). */
  texto: string;
  /** URL fiscal de consulta; si viene, se imprime el QR nativo antes del corte. */
  qrUrl?: string | null;
  celdaQr?: number;
  correccionQr?: 'L' | 'M' | 'Q' | 'H';
  /** Líneas de avance antes del corte para que nada quede cortado. */
  lineasAntesDeCorte?: number;
  paginaCodigos?: number;
};

/**
 * Arma el flujo ESC/POS completo: init, página de códigos, cuerpo, QR (si hay)
 * y corte con avance suficiente. No envía nada: devuelve los bytes.
 */
export const renderEscpos = ({
  texto,
  qrUrl,
  celdaQr = 5,
  correccionQr = 'M',
  lineasAntesDeCorte = 4,
  paginaCodigos = PAGINA_CODIGOS_POR_DEFECTO,
}: OpcionesRender): Buffer => {
  const cuerpo = String(texto ?? '');
  const cuerpoConSalto = cuerpo.endsWith('\n') ? cuerpo : `${cuerpo}\n`;

  const partes: Buffer[] = [
    iniciar(),
    seleccionarPaginaCodigos(paginaCodigos),
    alinear('centro'),
    avanzar(1),
    codificarTexto(cuerpoConSalto),
  ];

  if (qrUrl) {
    partes.push(avanzar(1), comandoQR(qrUrl, { celda: celdaQr, correccion: correccionQr }), avanzar(1));
  }

  partes.push(avanzar(lineasAntesDeCorte), cortar());

  return Buffer.concat(partes);
};
