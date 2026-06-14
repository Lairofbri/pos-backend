// src/modules/cocina/cocina.service.js
// Lógica de negocio para pantalla de cocina y comandas

const { query } = require('../../config/database');
const { ESTADOS_COCINA } = require('../../utils/constants');

/**
 * Listar items activos en cocina (en_proceso o listos)
 * Agrupados por orden, ordenados por tiempo de envío
 */
const listarItemsActivos = async ({ tenantId, soloPendientes = false }) => {
  const estados = soloPendientes ? ["'en_proceso'"] : ["'en_proceso'", "'listo'"];

  const { rows } = await query(
    `SELECT
       oi.id, oi.orden_id, oi.producto_id, oi.nombre_producto,
       oi.cantidad, oi.subtotal, oi.estado, oi.notas,
       oi.enviado_en, oi.creado_en,
       o.numero_orden, o.tipo, o.origen,
       m.numero AS mesa_numero, m.nombre AS mesa_nombre,
       u.nombre AS enviado_por_nombre
     FROM orden_items oi
     JOIN ordenes o ON o.id = oi.orden_id
     LEFT JOIN mesas m ON m.id = o.mesa_id
     LEFT JOIN usuarios u ON u.id = oi.enviado_por
     WHERE oi.tenant_id = $1
       AND oi.estado IN (${estados})
     ORDER BY
       oi.estado ASC,
       oi.enviado_en ASC NULLS LAST,
       o.mesa_id ASC`,
    [tenantId]
  );

  // Agrupar por orden
  const ordenes = {};
  for (const item of rows) {
    const key = item.orden_id;
    if (!ordenes[key]) {
      ordenes[key] = {
        orden_id: item.orden_id,
        numero_orden: item.numero_orden,
        tipo: item.tipo,
        origen: item.origen,
        mesa_numero: item.mesa_numero,
        mesa_nombre: item.mesa_nombre,
        items: [],
      };
    }
    ordenes[key].items.push({
      id: item.id,
      producto_id: item.producto_id,
      nombre_producto: item.nombre_producto,
      cantidad: item.cantidad,
      estado: item.estado,
      notas: item.notas,
      enviado_en: item.enviado_en,
      enviado_por_nombre: item.enviado_por_nombre,
      creado_en: item.creado_en,
    });
  }

  return Object.values(ordenes).sort((a, b) => a.items[0].enviado_en > b.items[0].enviado_en ? 1 : -1);
};

/**
 * Generar texto de ticket de cocina para impresora térmica
 * Formato 80mm/58mm — texto plano
 */
const getTicketTexto = async ({ tenantId, ordenId }) => {
  const { rows: ordenRows } = await query(
    `SELECT o.numero_orden, o.tipo, o.notas, o.creado_en,
            m.numero AS mesa_numero,
            u.nombre AS usuario_nombre
     FROM ordenes o
     LEFT JOIN mesas m ON m.id = o.mesa_id
     LEFT JOIN usuarios u ON u.id = o.usuario_id
     WHERE o.id = $1 AND o.tenant_id = $2`,
    [ordenId, tenantId]
  );

  if (ordenRows.length === 0) {
    throw { status: 404, mensaje: 'Orden no encontrada.' };
  }

  const orden = ordenRows[0];

  const { rows: items } = await query(
    `SELECT nombre_producto, cantidad, notas, estado, enviado_en
     FROM orden_items
     WHERE orden_id = $1 AND tenant_id = $2
       AND estado IN ('en_proceso', 'listo')
     ORDER BY creado_en ASC`,
    [ordenId, tenantId]
  );

  const ahora = new Date();
  const hora = ahora.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
  const fecha = ahora.toLocaleDateString('es-SV');

  let ticket = [];
  ticket.push('╔══════════════════════════╗');
  ticket.push('║      COMANDAS COCINA     ║');
  ticket.push('╚══════════════════════════╝');
  ticket.push('');
  ticket.push(`Fecha: ${fecha}  ${hora}`);
  ticket.push(`Orden #${orden.numero_orden}`);
  ticket.push(`Mesa: ${orden.mesa_numero || 'Para llevar'}`);
  ticket.push(`Tipo: ${orden.tipo}`);
  ticket.push(`Mesero: ${orden.usuario_nombre || '-'}`);
  ticket.push('────────────────────────────');

  for (const item of items) {
    ticket.push('');
    ticket.push(`  ${item.cantidad}x  ${item.nombre_producto}`);
    if (item.notas) {
      ticket.push(`       └─ ${item.notas}`);
    }
  }

  ticket.push('');
  ticket.push('────────────────────────────');
  ticket.push('Notas:');
  ticket.push(`  ${orden.notas || '(sin notas)'}`);
  ticket.push('');
  ticket.push('════════════════════════════');
  ticket.push('');

  return ticket.join('\n');
};

module.exports = { listarItemsActivos, getTicketTexto };
