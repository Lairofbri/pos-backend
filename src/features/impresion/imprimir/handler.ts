import type { Request, Response } from 'express';
import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { obtenerClientePorTenant } from '../../../shared/dte-client.js';
import { servicioEmpresaDte } from '../../../shared/dte-empresa.js';
import { validarUuidQuery } from '../../../shared/middlewares/uuid.middleware.js';
import { obtener } from '../impresoras/service.js';
import { formatoPreCuenta, formatoTicketConsumo, formatoCocina, formatoFactura, resolverAncho, ANCHO_POR_DEFECTO } from './formats.js';
import { renderEscpos } from './escpos.js';
import { enviarBytesTcp } from './tcp.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en impresion', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

const TIPOS_FORMATOS: Record<string, { formato: typeof formatoPreCuenta; printerTipo: string }> = {
  'pre-cuenta': { formato: formatoPreCuenta, printerTipo: 'pre-cuenta' },
  'ticket-consumo': { formato: formatoTicketConsumo, printerTipo: 'ticket-consumo' },
  cocina: { formato: formatoCocina, printerTipo: 'cocina' },
  factura: { formato: formatoFactura, printerTipo: 'ticket-consumo' },
};

const obtenerDatosOrden = async (tenantId: string, ordenId: string) => {
  const { rows: ordenRows } = await query(
    `SELECT o.*, m.numero AS mesa_numero,
            CONCAT_WS(' ', c.nombre, c.apellido) AS cliente_nombre,
            c.nit AS cliente_nit, c.nrc AS cliente_nrc,
            c.direccion AS cliente_direccion,
            u.nombre AS usuario_nombre, u.rol AS usuario_rol
     FROM ordenes o
     LEFT JOIN mesas m ON m.id = o.mesa_id
     LEFT JOIN clientes c ON c.id = o.cliente_id
     LEFT JOIN usuarios u ON u.id = o.usuario_id
     WHERE o.id = $1 AND o.tenant_id = $2`,
    [ordenId, tenantId]
  );

  if (ordenRows.length === 0) throw { status: 404, mensaje: 'Orden no encontrada.' };

  const { rows: items } = await query(
    `SELECT id, producto_id, nombre_producto, precio_unitario, cantidad,
            subtotal, COALESCE(descuento_porcentaje, 0) as descuento_porcentaje,
            (subtotal - (subtotal * COALESCE(descuento_porcentaje, 0) / 100)) as subtotal_con_descuento,
            estado, notas, creado_en, enviado_en
     FROM orden_items
     WHERE orden_id = $1 AND tenant_id = $2 AND estado != 'cancelado'
     ORDER BY creado_en ASC`,
    [ordenId, tenantId]
  );

  const { rows: pagos } = await query(
    `SELECT id, metodo, monto_efectivo, monto_tarjeta, total_pagado, vuelto, referencia_tarjeta, creado_en
     FROM pagos WHERE orden_id = $1 AND tenant_id = $2`,
    [ordenId, tenantId]
  );

  // F3 — la identidad de EMPRESA que se imprime en el ticket sale del DTE
  // (fuente de verdad), no de la tabla local `tenants`.
  const tenant = await servicioEmpresaDte.obtenerDatosEmisor(tenantId);

  return { orden: ordenRows[0], items, pagos, tenant };
};

const obtenerDteFiscal = async (tenantId: string, codigoGeneracion: string | null) => {
  if (!codigoGeneracion) {
    throw { status: 404, mensaje: 'La orden no tiene un DTE asociado.' };
  }

  const { rows } = await query(
    `SELECT tipo_dte, codigo_generacion, numero_control, estado
     FROM dtes_orden
     WHERE tenant_id = $1 AND codigo_generacion = $2
     ORDER BY creado_en DESC
     LIMIT 1`,
    [tenantId, codigoGeneracion]
  );
  const referencia = rows[0] as Record<string, unknown> | undefined;

  if (!referencia) {
    throw { status: 404, mensaje: 'No se encontró el registro fiscal de la orden.' };
  }
  if (referencia.estado !== 'aceptado') {
    throw { status: 409, mensaje: `El DTE no puede imprimirse como fiscal porque está en estado "${referencia.estado}".` };
  }

  const cliente = await obtenerClientePorTenant(tenantId);
  const dte = await cliente.get(`/api/dte/${encodeURIComponent(codigoGeneracion)}`) as Record<string, unknown>;
  return { ...referencia, ...dte };
};

/** Primer impresora activa del tipo pedido (o la indicada por id). */
const buscarImpresora = async (tenantId: string, printerTipo: string, impresoraId?: string) => {
  if (impresoraId) return await obtener(tenantId, impresoraId) as Record<string, unknown>;

  const { rows } = await query(
    `SELECT * FROM impresoras
     WHERE tenant_id = $1 AND tipo = $2 AND activo = true
     ORDER BY creado_en ASC LIMIT 1`,
    [tenantId, printerTipo]
  );
  return (rows[0] as Record<string, unknown>) ?? null;
};

/** Renderiza el ticket y lo envía por TCP a una impresora de red. */
const imprimirEnRed = async ({ ip, puerto, texto, qrUrl }: {
  ip: string;
  puerto: number;
  texto: string;
  qrUrl?: string | null;
}) => {
  const bytes = renderEscpos({ texto, qrUrl });
  await enviarBytesTcp({ ip, puerto, bytes });
};

export const imprimir = async (req: Request, res: Response) => {
  const { tipo, impresora_id } = req.body as { tipo?: string; impresora_id?: string };
  if (!tipo || !['pre-cuenta', 'ticket-consumo', 'cocina', 'factura'].includes(tipo)) {
    return error(res, 'Tipo de ticket requerido: pre-cuenta, ticket-consumo, cocina o factura.', 400);
  }

  try {
    const config = TIPOS_FORMATOS[tipo];
    if (!config) throw { status: 400, mensaje: `Tipo de ticket invalido: ${tipo}` };

    const impresora = await buscarImpresora(req.usuario!.tenant_id, config.printerTipo, impresora_id);
    if (!impresora) {
      throw { status: 404, mensaje: `No hay impresora activa configurada para "${tipo}". Configurala en Admin > Impresoras.` };
    }

    const ancho = resolverAncho(impresora.papel_mm as number, impresora.caracteres_x_linea as number);
    const { orden, items, pagos, tenant } = await obtenerDatosOrden(req.usuario!.tenant_id, req.params.ordenId as string);
    const dte = tipo === 'factura'
      ? await obtenerDteFiscal(req.usuario!.tenant_id, (orden.dte_codigo_generacion as string) || null)
      : null;

    const texto = config.formato({ orden, tenant, items, pagos, dte, ancho });

    try {
      await imprimirEnRed({
        ip: impresora.ip as string,
        puerto: impresora.puerto as number,
        texto,
        qrUrl: dte?.qr_url as string | null | undefined,
      });

      logger.info('Ticket impreso', { tenant_id: req.usuario!.tenant_id, orden_id: req.params.ordenId, tipo, impresora: impresora.nombre as string });
      return exito(res, { impreso: true, impresora: impresora.nombre as string });
    } catch (err) {
      logger.error('Error al imprimir', { error: (err as Error).message, orden_id: req.params.ordenId, tipo, impresora: impresora.nombre as string, ip: impresora.ip as string });
      throw { status: 502, mensaje: `Error de impresion: ${(err as Error).message}` };
    }
  } catch (err) { return manejarError(res, err); }
};

export const imprimirPrueba = async (req: Request, res: Response) => {
  const { impresora_id } = req.body as { impresora_id?: string };
  if (!impresora_id) return error(res, 'impresora_id es requerido.', 400);

  try {
    const impresora = await obtener(req.usuario!.tenant_id, impresora_id);

    const ancho = resolverAncho(impresora.papel_mm as number, impresora.caracteres_x_linea as number);
    const caja = (texto: string) => {
      const relleno = Math.max(0, ancho - 8 - texto.length);
      return `${' '.repeat(6)}║${texto}${' '.repeat(relleno)}║`;
    };

    const texto = [
      '', `      ╔${'═'.repeat(Math.max(4, ancho - 8))}╗`,
      caja('   PRUEBA DE IMPRESION'),
      `      ╚${'═'.repeat(Math.max(4, ancho - 8))}╝`, '',
      '  Si ves este texto, la',
      '  impresora termica funciona',
      '  correctamente.', '',
      `  Impresora: ${impresora.nombre as string}`,
      `  IP: ${impresora.ip as string}:${impresora.puerto as number}`,
      `  Fecha: ${new Date().toLocaleString('es-SV')}`, '',
      '  Gracias por usar AMBER POS!', '',
      '─'.repeat(ancho), '',
    ].join('\n');

    await imprimirEnRed({ ip: impresora.ip as string, puerto: impresora.puerto as number, texto });
    return exito(res, { impreso: true, mensaje: 'Prueba de impresion exitosa' });
  } catch (err) {
    return manejarError(res, err);
  }
};

const TIPOS_ESC_POS = ['pre-cuenta', 'ticket-consumo', 'cocina', 'factura'] as const;
type TipoEscPos = typeof TIPOS_ESC_POS[number];

/**
 * GET /impresion/ticket-escpos/:ordenId?tipo=...&impresora_id=...
 *
 * Devuelve los bytes ESC/POS listos para escribir, para que el agente local
 * los envíe a la impresora (decisión D3: el backend es la fuente de verdad).
 * No toca el cobro, la venta ni el DTE: solo lee lo ya persistido.
 * Si no hay impresora configurada NO falla: usa el ancho por defecto (80 mm).
 */
export const ticketEscpos = async (req: Request, res: Response) => {
  const tipo = String(req.query.tipo ?? 'pre-cuenta') as TipoEscPos;
  if (!TIPOS_ESC_POS.includes(tipo)) {
    return error(res, `Tipo de ticket invalido: ${tipo}. Validos: ${TIPOS_ESC_POS.join(', ')}.`, 400);
  }

  const impresoraId = typeof req.query.impresora_id === 'string' ? req.query.impresora_id : undefined;
  if (!validarUuidQuery(res, impresoraId, 'impresora_id')) return;

  try {
    const config = TIPOS_FORMATOS[tipo];

    // La impresora es opcional: de ella solo se hereda el ancho de papel.
    const impresora = await buscarImpresora(req.usuario!.tenant_id, config.printerTipo, impresoraId);
    const ancho = impresora
      ? resolverAncho(impresora.papel_mm as number, impresora.caracteres_x_linea as number)
      : ANCHO_POR_DEFECTO;

    const { orden, items, pagos, tenant } = await obtenerDatosOrden(req.usuario!.tenant_id, req.params.ordenId as string);
    const dte = tipo === 'factura'
      ? await obtenerDteFiscal(req.usuario!.tenant_id, (orden.dte_codigo_generacion as string) || null)
      : null;

    const texto = config.formato({ orden, tenant, items, pagos, dte, ancho });
    const bytes = renderEscpos({ texto, qrUrl: dte?.qr_url as string | null | undefined });

    logger.info('Ticket ESC/POS generado', {
      tenant_id: req.usuario!.tenant_id,
      orden_id: req.params.ordenId,
      tipo,
      bytes: bytes.length,
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline; filename="ticket-escpos.bin"');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(bytes);
  } catch (err) {
    return manejarError(res, err);
  }
};
