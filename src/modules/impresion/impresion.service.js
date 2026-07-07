// src/modules/impresion/impresion.service.js
// Lógica de impresión térmica: genera ESC/POS y envía por TCP

const { Printer } = require('node-thermal-printer');
const net = require('net');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const {
  formatoPreCuenta,
  formatoTicketConsumo,
  formatoFactura,
} = require('./impresion.formats');

// ─────────────────────────────────────────────
// CRUD de impresoras
// ─────────────────────────────────────────────

const listar = async (tenantId) => {
  const { rows } = await query(
    'SELECT * FROM impresoras WHERE tenant_id = $1 ORDER BY tipo, nombre',
    [tenantId]
  );
  return rows;
};

const obtener = async (tenantId, id) => {
  const { rows } = await query(
    'SELECT * FROM impresoras WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  if (rows.length === 0) throw { status: 404, mensaje: 'Impresora no encontrada.' };
  return rows[0];
};

const crear = async (tenantId, datos) => {
  const { nombre, tipo, conexion = 'red', ip, puerto = 9100, papel_mm = 80, caracteres_x_linea = 42 } = datos;

  const { rows } = await query(
    `INSERT INTO impresoras
       (tenant_id, nombre, tipo, conexion, ip, puerto, papel_mm, caracteres_x_linea)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [tenantId, nombre, tipo, conexion, ip, puerto, papel_mm, caracteres_x_linea]
  );

  logger.info('Impresora creada', { tenant_id: tenantId, nombre, tipo });
  return rows[0];
};

const actualizar = async (tenantId, id, datos) => {
  await obtener(tenantId, id);

  const campos = [];
  const valores = [];
  let idx = 1;

  if (datos.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(datos.nombre); }
  if (datos.tipo !== undefined) { campos.push(`tipo = $${idx++}`); valores.push(datos.tipo); }
  if (datos.ip !== undefined) { campos.push(`ip = $${idx++}`); valores.push(datos.ip); }
  if (datos.puerto !== undefined) { campos.push(`puerto = $${idx++}`); valores.push(datos.puerto); }
  if (datos.papel_mm !== undefined) { campos.push(`papel_mm = $${idx++}`); valores.push(datos.papel_mm); }
  if (datos.caracteres_x_linea !== undefined) { campos.push(`caracteres_x_linea = $${idx++}`); valores.push(datos.caracteres_x_linea); }
  if (datos.activo !== undefined) { campos.push(`activo = $${idx++}`); valores.push(datos.activo); }

  if (campos.length === 0) return obtener(tenantId, id);

  campos.push(`actualizado_en = NOW()`);
  valores.push(id, tenantId);

  const { rows } = await query(
    `UPDATE impresoras SET ${campos.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING *`,
    valores
  );

  logger.info('Impresora actualizada', { id, tenant_id: tenantId });
  return rows[0];
};

const eliminar = async (tenantId, id) => {
  await obtener(tenantId, id);
  await query('DELETE FROM impresoras WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
  logger.info('Impresora eliminada', { id, tenant_id: tenantId });
};

// ─────────────────────────────────────────────
// Impresión de tickets
// ─────────────────────────────────────────────

const TIPOS_FORMATOS = {
  'pre-cuenta': {
    formato: formatoPreCuenta,
    printerTipo: 'pre-cuenta',
  },
  'ticket-consumo': {
    formato: formatoTicketConsumo,
    printerTipo: 'ticket-consumo',
  },
  factura: {
    formato: formatoFactura,
    printerTipo: 'ticket-consumo',
  },
};

/**
 * Obtiene los datos completos de una orden para imprimir
 */
const obtenerDatosOrden = async (tenantId, ordenId) => {
  const { rows: ordenRows } = await query(
    `SELECT
       o.*, m.numero AS mesa_numero, m.zona,
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

  // Obtener datos del tenant (negocio)
  const { rows: tenantRows } = await query(
    `SELECT id, nombre, nit, nrc, direccion, telefono, email, logo_url
     FROM tenants WHERE id = $1`,
    [tenantId]
  );

  return {
    orden: ordenRows[0],
    items,
    pagos,
    tenant: tenantRows[0] || {},
  };
};

/**
 * Envía texto ESC/POS a una impresora de red
 */
const imprimirEnRed = async ({ ip, puerto, texto, papelMm = 80 }) => {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let error = null;

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout conectando a ${ip}:${puerto}`));
    }, 5000);

    socket.connect(puerto, ip, () => {
      clearTimeout(timeout);
      try {
        const printer = new Printer({
          type: 'epson',
          interface: `tcp://${ip}:${puerto}`,
          width: papelMm === 58 ? 32 : 42,
          characterSet: 'PC852_LATIN2',
          removeSpecialCharacters: false,
        });

        printer.alignCenter();
        printer.println(' ');
        printer.println(texto);
        printer.println(' ');
        printer.cut();

        const buffer = printer.getBuffer();
        socket.write(buffer, (err) => {
          if (err) {
            socket.destroy();
            reject(err);
          } else {
            socket.destroy();
            resolve();
          }
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

/**
 * Envía texto plano a una impresora de red
 */
const imprimirTextoPlano = async ({ ip, puerto, texto }) => {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout conectando a ${ip}:${puerto}`));
    }, 5000);

    socket.connect(puerto, ip, () => {
      clearTimeout(timeout);
      socket.write(texto + '\n\n\n\n\n\n\n\n', (err) => {
        socket.destroy();
        if (err) return reject(err);
        resolve();
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
};

/**
 * Imprime un ticket de orden
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.ordenId
 * @param {'pre-cuenta'|'ticket-consumo'|'factura'} params.tipo
 * @param {string} [params.impresoraId] - Opcional, usa la activa del tipo si no se especifica
 * @param {Object} [params.dte] - Datos del DTE (para factura)
 */
const imprimirTicket = async ({ tenantId, ordenId, tipo, impresoraId, dte }) => {
  const config = TIPOS_FORMATOS[tipo];
  if (!config) throw { status: 400, mensaje: `Tipo de ticket invalido: ${tipo}` };

  // Obtener impresora
  let impresora;
  if (impresoraId) {
    impresora = await obtener(tenantId, impresoraId);
  } else {
    const { rows } = await query(
      `SELECT * FROM impresoras
       WHERE tenant_id = $1 AND tipo = $2 AND activo = true
       ORDER BY creado_en ASC LIMIT 1`,
      [tenantId, config.printerTipo]
    );
    if (rows.length === 0) {
      throw { status: 404, mensaje: `No hay impresora activa configurada para "${tipo}". Configurala en Admin > Impresoras.` };
    }
    impresora = rows[0];
  }

  // Obtener datos de la orden
  const { orden, items, pagos, tenant } = await obtenerDatosOrden(tenantId, ordenId);

  // Generar texto del ticket
  const texto = config.formato({ orden, tenant, items, pagos, dte });

  // Enviar a impresora
  try {
    await imprimirEnRed({
      ip: impresora.ip,
      puerto: impresora.puerto,
      texto,
      papelMm: impresora.papel_mm,
    });

    logger.info('Ticket impreso', {
      tenant_id: tenantId,
      orden_id: ordenId,
      tipo,
      impresora: impresora.nombre,
    });

    return { impreso: true, impresora: impresora.nombre };
  } catch (err) {
    logger.error('Error al imprimir', {
      error: err.message,
      orden_id: ordenId,
      tipo,
      impresora: impresora.nombre,
      ip: impresora.ip,
    });
    throw { status: 502, mensaje: `Error de impresion: ${err.message}` };
  }
};

/**
 * Imprime página de prueba
 */
const imprimirPrueba = async (tenantId, impresoraId) => {
  const impresora = await obtener(tenantId, impresoraId);

  const texto = [
    '',
    '      ╔══════════════════════╗',
    '      ║   PRUEBA DE IMPRESION ║',
    '      ╚══════════════════════╝',
    '',
    '  Si ves este texto, la',
    '  impresora termica funciona',
    '  correctamente.',
    '',
    `  Impresora: ${impresora.nombre}`,
    `  IP: ${impresora.ip}:${impresora.puerto}`,
    `  Fecha: ${new Date().toLocaleString('es-SV')}`,
    '',
    '  Gracias por usar AMBER POS!',
    '',
    '─'.repeat(42),
    '',
  ].join('\n');

  try {
    await imprimirEnRed({
      ip: impresora.ip,
      puerto: impresora.puerto,
      texto,
      papelMm: impresora.papel_mm,
    });
    return { impreso: true, mensaje: 'Prueba de impresion exitosa' };
  } catch (err) {
    throw { status: 502, mensaje: `Error de impresion: ${err.message}` };
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  imprimirTicket,
  imprimirPrueba,
  obtenerDatosOrden,
};
