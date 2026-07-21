import { query, getClient } from '../../../../shared/config/database.js';
import { logger } from '../../../../shared/utils/logger.js';
import { ESTADOS_FINALES } from '../../../../shared/utils/constants.js';
import { obtenerOrdenShared, recalcularOrden } from '../../shared.js';
import { io } from '../../../../server.js';

const agregarComboAOrden = async ({ tenantId, ordenId, usuarioId, datos, combo }: { tenantId: string; ordenId: string; usuarioId: string; datos: Record<string, unknown>; combo: Record<string, unknown> }) => {
  const { rows: componentes } = await query(
    `SELECT cp.producto_id, cp.cantidad, p.nombre, p.precio, p.tiene_stock, p.stock_actual, p.activo
     FROM combo_productos cp
     JOIN productos p ON p.id = cp.producto_id
     WHERE cp.combo_id = $1`,
    [combo.id]
  );

  if ((componentes as Array<Record<string, unknown>>).length === 0) {
    throw { status: 400, mensaje: `El combo "${combo.nombre}" no tiene productos asignados.` };
  }

  const cantidadCombos = (datos.cantidad as number) || 1;
  const precioCombo = Number(combo.precio) || 0;
  const precioComboTotal = Number((precioCombo * cantidadCombos).toFixed(2));

  for (const c of componentes as Array<Record<string, unknown>>) {
    if (!c.activo) {
      throw { status: 400, mensaje: `"${c.nombre}" no está disponible actualmente.` };
    }
    const cantidadTotal = (c.cantidad as number) * cantidadCombos;
    if (c.tiene_stock && (c.stock_actual as number) < cantidadTotal) {
      throw {
        status: 400,
        mensaje: `Stock insuficiente para "${c.nombre}". Necesita ${cantidadTotal}, hay ${c.stock_actual}.`,
      };
    }
  }

  const orden = await obtenerOrdenShared({ tenantId, ordenId });
  const ordenEnProceso = orden.estado === 'en_proceso';
  const estadoItems = ordenEnProceso ? 'en_proceso' : 'pendiente';

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Insertar línea virtual del combo (producto_id = NULL, con precio)
    const { rows: comboLineRows } = await client.query(
      `INSERT INTO orden_items
         (orden_id, tenant_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, notas, descuento_porcentaje, combo_id, estado${ordenEnProceso ? ', enviado_en, enviado_por' : ''})
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10${ordenEnProceso ? ', NOW(), $11' : ''})
       RETURNING id, producto_id, nombre_producto AS nombre, precio_unitario, cantidad, subtotal, descuento_porcentaje, estado, notas, combo_id`,
      [
        ordenId, tenantId, combo.nombre, precioCombo,
        cantidadCombos, precioComboTotal, (datos.notas as string) || null, (datos.descuento_porcentaje as number) ?? 0,
        combo.id, estadoItems, ...(ordenEnProceso ? [usuarioId] : []),
      ]
    );

    const itemsInsertados: Array<Record<string, unknown>> = [];
    const comboLine = comboLineRows[0] as Record<string, unknown>;
    itemsInsertados.push(comboLine);

    // 2. Insertar componentes (precio_unitario = 0, subtotal = 0)
    for (const c of componentes as Array<Record<string, unknown>>) {
      const cantidadTotal = (c.cantidad as number) * cantidadCombos;

      const { rows } = await client.query(
        `INSERT INTO orden_items
           (orden_id, tenant_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, notas, descuento_porcentaje, combo_id, estado${ordenEnProceso ? ', enviado_en, enviado_por' : ''})
         VALUES ($1, $2, $3, $4, 0, $5, 0, $6, $7, $8, $9${ordenEnProceso ? ', NOW(), $10' : ''})
         RETURNING id, producto_id, nombre_producto AS nombre, precio_unitario, cantidad, subtotal, descuento_porcentaje, estado, notas, combo_id`,
        [
          ordenId, tenantId, c.producto_id, c.nombre,
          cantidadTotal, (datos.notas as string) || null, (datos.descuento_porcentaje as number) ?? 0,
          combo.id, estadoItems, ...(ordenEnProceso ? [usuarioId] : []),
        ]
      );

      if (c.tiene_stock) {
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND tenant_id = $3',
          [cantidadTotal, c.producto_id, tenantId]
        );
      }

      itemsInsertados.push(rows[0] as Record<string, unknown>);
    }

    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');

    if (ordenEnProceso) {
      for (const item of itemsInsertados) {
        io.to(`tenant:${tenantId}`).emit('cocina:nuevo-item', {
          item_id: item.id,
          orden_id: ordenId,
          nombre_producto: item.nombre,
          cantidad: item.cantidad,
          notas: item.notas,
        });
      }
    }

    logger.info('Combo agregado a orden', {
      orden_id: ordenId,
      combo: combo.nombre as string,
      items: (componentes as Array<unknown>).length,
      precio_combo_total: precioComboTotal,
      enviado_a_cocina: ordenEnProceso,
    });

    return { items: itemsInsertados, totales, es_combo: true, combo_nombre: combo.nombre };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const agregarItem = async ({ tenantId, ordenId, usuarioId, datos }: { tenantId: string; ordenId: string; usuarioId: string; datos: Record<string, unknown> }) => {
  const orden = await obtenerOrdenShared({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(orden.estado as string)) {
    throw { status: 400, mensaje: `No se pueden agregar items a una orden "${orden.estado}".` };
  }

  const { rows: comboRows } = await query(
    'SELECT id, nombre, precio, activo FROM combos WHERE id = $1 AND tenant_id = $2',
    [(datos as Record<string, unknown>).producto_id, tenantId]
  );

  if ((comboRows as Array<Record<string, unknown>>).length > 0) {
    return agregarComboAOrden({ tenantId, ordenId, usuarioId, datos, combo: comboRows[0] as Record<string, unknown> });
  }

  const { rows: productoRows } = await query(
    `SELECT id, nombre, precio, activo, tiene_stock, stock_actual
     FROM productos WHERE id = $1 AND tenant_id = $2`,
    [(datos as Record<string, unknown>).producto_id, tenantId]
  );

  if ((productoRows as Array<Record<string, unknown>>).length === 0) {
    throw { status: 404, mensaje: 'Producto no encontrado.' };
  }

  const producto = (productoRows as Array<Record<string, unknown>>)[0];

  if (!producto.activo) {
    throw { status: 400, mensaje: `El producto "${producto.nombre}" no está disponible.` };
  }

  if (producto.tiene_stock && (producto.stock_actual as number) < (datos.cantidad as number)) {
    throw {
      status: 400,
      mensaje: `Stock insuficiente para "${producto.nombre}". Stock actual: ${producto.stock_actual}.`,
    };
  }

  const subtotalItem = Number(((producto.precio as number) * (datos.cantidad as number)).toFixed(2));

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO orden_items
         (orden_id, tenant_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, notas, descuento_porcentaje)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, descuento_porcentaje, estado, notas`,
      [
        ordenId, tenantId, producto.id, producto.nombre, producto.precio,
        datos.cantidad, subtotalItem, (datos.notas as string) || null, (datos.descuento_porcentaje as number) ?? 0,
      ]
    );

    if (producto.tiene_stock) {
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND tenant_id = $3',
        [datos.cantidad, producto.id, tenantId]
      );
    }

    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');

    const nuevoItem = rows[0] as Record<string, unknown>;
    io.to(`tenant:${tenantId}`).emit('cocina:nuevo-item', {
      item_id: nuevoItem.id,
      orden_id: ordenId,
      nombre_producto: nuevoItem.nombre_producto,
      cantidad: nuevoItem.cantidad,
      notas: nuevoItem.notas,
    });

    logger.info('Item agregado a orden', {
      orden_id: ordenId,
      producto: producto.nombre as string,
      cantidad: datos.cantidad as number,
      subtotal: subtotalItem,
    });

    return { item: rows[0], totales };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
