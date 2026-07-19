import { query, getClient } from '../../shared/config/database.js';
import { TASA_IVA } from '../../shared/utils/constants.js';

export const calcularTotales = (subtotal: number, porcentajeDescuento = 0) => {
  const descuento = Number((subtotal * (porcentajeDescuento / 100)).toFixed(2));
  const total = Number((subtotal - descuento).toFixed(2));
  const gravado = Number((total / (1 + TASA_IVA)).toFixed(2));
  const iva = Number((total - gravado).toFixed(2));
  return { subtotal, descuento, total, gravado, iva };
};

export const recalcularOrden = async (client: Awaited<ReturnType<typeof getClient>>, ordenId: string, tenantId: string) => {
  const { rows: itemsRows } = await client.query(
    `SELECT COALESCE(SUM(subtotal - (subtotal * COALESCE(descuento_porcentaje, 0) / 100)), 0) as subtotal
     FROM orden_items
     WHERE orden_id = $1 AND tenant_id = $2 AND estado != 'cancelado'`,
    [ordenId, tenantId]
  );

  const { rows: ordenRows } = await client.query(
    'SELECT porcentaje_descuento, propina_porcentaje, propina_monto FROM ordenes WHERE id = $1 AND tenant_id = $2',
    [ordenId, tenantId]
  );

  const subtotalBase = Number(itemsRows[0].subtotal);
  const porcentajeDescuento = Number(ordenRows[0].porcentaje_descuento);
  const totales = calcularTotales(subtotalBase, porcentajeDescuento);

  const propinaPorcentaje = Number(ordenRows[0].propina_porcentaje || 0);
  let propinaMonto = Number(ordenRows[0].propina_monto || 0);
  if (propinaPorcentaje > 0) {
    propinaMonto = Number((totales.total * propinaPorcentaje / 100).toFixed(2));
  }

  await client.query(
    `UPDATE ordenes SET
       subtotal = $1, descuento = $2, total = $3, gravado = $4, iva = $5, propina_monto = $6
     WHERE id = $7 AND tenant_id = $8`,
    [totales.subtotal, totales.descuento, totales.total, totales.gravado, totales.iva, propinaMonto, ordenId, tenantId]
  );

  return { ...totales, propina_monto: propinaMonto };
};

export const TRANSICIONES_VALIDAS: Record<string, string[]> = {
  abierta: ['en_proceso', 'cancelada'],
  en_proceso: ['lista', 'cancelada'],
  lista: ['entregada', 'cancelada'],
  entregada: ['pagada', 'cancelada'],
  pagada: [],
  cancelada: [],
};

export const validarTransicion = (estadoActual: string, estadoNuevo: string) => {
  const permitidos = TRANSICIONES_VALIDAS[estadoActual] || [];
  if (!permitidos.includes(estadoNuevo)) {
    throw {
      status: 400,
      mensaje: `No se puede cambiar de "${estadoActual}" a "${estadoNuevo}". Transiciones permitidas: ${permitidos.join(', ') || 'ninguna'}.`,
    };
  }
};

export const adjuntarOrdenActiva = async (mesas: Record<string, unknown> | Record<string, unknown>[], tenantId: string) => {
  const esArray = Array.isArray(mesas);
  const lista = esArray ? mesas : [mesas];
  if (lista.length === 0) return mesas;

  const mesaIds = lista.map(m => m.id);
  const { rows: ordenes } = await query(
    `SELECT mesa_id, id as orden_id, creado_en as orden_creada_en, total as orden_total
     FROM ordenes
     WHERE mesa_id = ANY($1::uuid[]) AND tenant_id = $2 AND estado NOT IN ('pagada', 'cancelada')`,
    [mesaIds, tenantId]
  );

  const ordenPorMesa: Record<string, unknown> = {};
  for (const o of ordenes as Array<Record<string, unknown>>) {
    ordenPorMesa[o.mesa_id as string] = { id: o.orden_id, creado_en: o.orden_creada_en, total: o.orden_total };
  }

  for (const mesa of lista) {
    mesa.orden_activa = ordenPorMesa[mesa.id as string] || null;
  }

  return mesas;
};

export const obtenerMesaShared = async ({ tenantId, mesaId }: { tenantId: string; mesaId: string }) => {
  const { rows } = await query(
    `SELECT id, numero, nombre, capacidad, estado, activo, sucursal_id
     FROM mesas WHERE id = $1 AND tenant_id = $2`,
    [mesaId, tenantId]
  );
  if (rows.length === 0) throw { status: 404, mensaje: 'Mesa no encontrada.' };
  return rows[0];
};

export const moveItemsBetweenOrders = async ({ tenantId, ordenOrigenId, items }: { tenantId: string; ordenOrigenId: string; items: string[] }) => {
  const { rows: itemsVerificar } = await query(
    `SELECT id, estado FROM orden_items
     WHERE id = ANY($1::uuid[]) AND orden_id = $2 AND tenant_id = $3`,
    [items, ordenOrigenId, tenantId]
  );

  if (itemsVerificar.length !== items.length) {
    throw { status: 400, mensaje: 'Uno o más items no pertenecen a la orden origen o no existen.' };
  }

  for (const item of itemsVerificar as Array<{ id: string; estado: string }>) {
    if (item.estado === 'cancelado') {
      throw { status: 400, mensaje: 'No se pueden mover items cancelados.' };
    }
  }
};

export const obtenerOrdenShared = async ({ tenantId, ordenId }: { tenantId: string; ordenId: string }) => {
  const { rows: ordenRows } = await query(
    `SELECT
       o.id, o.tipo, o.estado, o.numero_orden, o.origen, o.numero_externo,
       o.subtotal, o.porcentaje_descuento, o.descuento,
       o.total, o.gravado, o.iva, o.notas,
       o.propina_porcentaje, o.propina_monto,
       o.mesa_id, o.cliente_id, o.usuario_id,
       o.creado_en, o.actualizado_en, o.cerrado_en,
        m.numero AS mesa_numero,
        CONCAT_WS(' ', c.nombre, c.apellido) AS cliente_nombre,
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
    `SELECT
       oi.id, oi.producto_id, oi.nombre_producto AS nombre, oi.precio_unitario,
       oi.cantidad, oi.subtotal, COALESCE(oi.descuento_porcentaje, 0) as descuento_porcentaje,
       (oi.subtotal - (oi.subtotal * COALESCE(oi.descuento_porcentaje, 0) / 100)) as subtotal_con_descuento,
       oi.estado, oi.notas, oi.enviado_en, oi.creado_en,
       oi.combo_id,
       (SELECT c.nombre FROM combos c WHERE c.id = oi.combo_id) AS combo_nombre
     FROM orden_items oi
     WHERE oi.orden_id = $1 AND oi.tenant_id = $2
     ORDER BY oi.creado_en ASC`,
    [ordenId, tenantId]
  );

  const { rows: pagos } = await query(
    `SELECT
       id, metodo, monto_efectivo, monto_tarjeta,
       total_pagado, vuelto, referencia_tarjeta, creado_en
     FROM pagos
     WHERE orden_id = $1 AND tenant_id = $2`,
    [ordenId, tenantId]
  );

  return { ...(ordenRows[0] as Record<string, unknown>), items, pagos } as Record<string, unknown>;
};
