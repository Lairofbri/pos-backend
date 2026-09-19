import type { Request, Response } from 'express';
import { ThermalPrinter as Printer, PrinterTypes, CharacterSet } from 'node-thermal-printer';
import net from 'net';
import { query } from '../../../shared/config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { obtenerClientePorTenant } from '../../../shared/dte-client.js';
import { obtener } from '../impresoras/service.js';
import { formatoPreCuenta, formatoTicketConsumo, formatoFactura } from './formats.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en impresion', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

const TIPOS_FORMATOS: Record<string, { formato: typeof formatoPreCuenta; printerTipo: string }> = {
  'pre-cuenta': { formato: formatoPreCuenta, printerTipo: 'pre-cuenta' },
  'ticket-consumo': { formato: formatoTicketConsumo, printerTipo: 'ticket-consumo' },
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

  const { rows: tenantRows } = await query(
    `SELECT id, nombre, nit, nrc, direccion, telefono, email, logo_url
     FROM tenants WHERE id = $1`,
    [tenantId]
  );

  return { orden: ordenRows[0], items, pagos, tenant: tenantRows[0] || {} };
};

const obtenerDteFiscal = async (tenantId: string, codigoGeneracion: string | null) => {
  if (!codigoGeneracion) {
    throw { status: 404, mensaje: 'La orden no tiene un DTE asociado.' };
  }

  const { rows } = await query(
    `SELECT tipo_dte, codigo_generacion, numero_control, estado, sello_recepcion
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

const imprimirEnRed = async ({ ip, puerto, texto, papelMm = 80, qrUrl }: {
  ip: string;
  puerto: number;
  texto: string;
  papelMm?: number;
  qrUrl?: string | null;
}) => {
  return new Promise<void>((resolve, reject) => {
    const socket = new net.Socket();

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout conectando a ${ip}:${puerto}`));
    }, 5000);

    socket.connect(puerto, ip, () => {
      clearTimeout(timeout);
      try {
        const printer = new Printer({
          type: PrinterTypes.EPSON,
          interface: `tcp://${ip}:${puerto}`,
          width: papelMm === 58 ? 32 : 42,
          characterSet: CharacterSet.PC852_LATIN2,
          removeSpecialCharacters: false,
        });

        printer.alignCenter();
        printer.println(' ');
        printer.println(texto);
        if (qrUrl) {
          printer.println(' ');
          printer.printQR(qrUrl, { model: 2, cellSize: 5, correction: 'M' });
          printer.println(' ');
        }
        printer.println(' ');
        printer.cut();

        const buffer = printer.getBuffer();
        socket.write(buffer, (err) => {
          if (err) { socket.destroy(); reject(err); }
          else { socket.destroy(); resolve(); }
        });
      } catch (err) {
        socket.destroy();
        reject(err);
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

export const imprimir = async (req: Request, res: Response) => {
  const { tipo, impresora_id } = req.body as { tipo?: string; impresora_id?: string };
  if (!tipo || !['pre-cuenta', 'ticket-consumo', 'factura'].includes(tipo)) {
    return error(res, 'Tipo de ticket requerido: pre-cuenta, ticket-consumo o factura.', 400);
  }

  try {
    const config = TIPOS_FORMATOS[tipo];
    if (!config) throw { status: 400, mensaje: `Tipo de ticket invalido: ${tipo}` };

    let impresora: Record<string, unknown>;
    if (impresora_id) {
      impresora = await obtener(req.usuario!.tenant_id, impresora_id);
    } else {
      const { rows } = await query(
        `SELECT * FROM impresoras
         WHERE tenant_id = $1 AND tipo = $2 AND activo = true
         ORDER BY creado_en ASC LIMIT 1`,
        [req.usuario!.tenant_id, config.printerTipo]
      );
      if (rows.length === 0) {
        throw { status: 404, mensaje: `No hay impresora activa configurada para "${tipo}". Configurala en Admin > Impresoras.` };
      }
      impresora = rows[0] as Record<string, unknown>;
    }

    const { orden, items, pagos, tenant } = await obtenerDatosOrden(req.usuario!.tenant_id, req.params.ordenId as string);
    const dte = tipo === 'factura'
      ? await obtenerDteFiscal(req.usuario!.tenant_id, (orden.dte_codigo_generacion as string) || null)
      : null;

    const texto = config.formato({ orden, tenant, items, pagos, dte });

    try {
      await imprimirEnRed({
        ip: impresora.ip as string,
        puerto: impresora.puerto as number,
        texto,
        papelMm: impresora.papel_mm as number,
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

    const texto = [
      '', '      ╔══════════════════════╗',
      '      ║   PRUEBA DE IMPRESION ║',
      '      ╚══════════════════════╝', '',
      '  Si ves este texto, la',
      '  impresora termica funciona',
      '  correctamente.', '',
      `  Impresora: ${impresora.nombre as string}`,
      `  IP: ${impresora.ip as string}:${impresora.puerto as number}`,
      `  Fecha: ${new Date().toLocaleString('es-SV')}`, '',
      '  Gracias por usar AMBER POS!', '',
      '─'.repeat(42), '',
    ].join('\n');

    await imprimirEnRed({ ip: impresora.ip as string, puerto: impresora.puerto as number, texto, papelMm: impresora.papel_mm as number });
    return exito(res, { impreso: true, mensaje: 'Prueba de impresion exitosa' });
  } catch (err) {
    return manejarError(res, err);
  }
};
