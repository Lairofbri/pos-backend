// src/modules/pos/pos.service.js
// Lógica de negocio del módulo POS
// Principio S (SOLID): solo opera con datos, no valida ni responde HTTP
// Principio O (SOLID): extensible sin modificar métodos existentes

const { query, getClient } = require('../../config/database');
const logger               = require('../../utils/logger');

// Tasa de IVA El Salvador
const TASA_IVA = 0.13;

// ─────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────

/**
 * Calcula subtotal, descuento, total, gravado e IVA de una orden
 * Los precios YA incluyen IVA — se desglosa al facturar
 */
const calcularTotales = (subtotal, porcentajeDescuento = 0) => {
  const descuento = Number((subtotal * (porcentajeDescuento / 100)).toFixed(2));
  const total     = Number((subtotal - descuento).toFixed(2));
  // Desglose IVA: gravado = total / 1.13, iva = total - gravado
  const gravado   = Number((total / (1 + TASA_IVA)).toFixed(2));
  const iva       = Number((total - gravado).toFixed(2));
  return { subtotal, descuento, total, gravado, iva };
};

/**
 * Recalcula y actualiza los totales de una orden en la BD
 * Se llama cada vez que se agrega, modifica o elimina un item
 */
const recalcularOrden = async (client, ordenId, tenantId) => {
  // Sumar subtotales de todos los items activos
  const { rows: itemsRows } = await client.query(
    `SELECT COALESCE(SUM(subtotal), 0) as subtotal
     FROM orden_items
     WHERE orden_id = $1 AND tenant_id = $2 AND estado != 'cancelado'`,
    [ordenId, tenantId]
  );

  const { rows: ordenRows } = await client.query(
    'SELECT porcentaje_descuento FROM ordenes WHERE id = $1',
    [ordenId]
  );

  const subtotalBase       = Number(itemsRows[0].subtotal);
  const porcentajeDescuento = Number(ordenRows[0].porcentaje_descuento);
  const totales            = calcularTotales(subtotalBase, porcentajeDescuento);

  await client.query(
    `UPDATE ordenes SET
       subtotal  = $1,
       descuento = $2,
       total     = $3,
       gravado   = $4,
       iva       = $5
     WHERE id = $6`,
    [totales.subtotal, totales.descuento, totales.total, totales.gravado, totales.iva, ordenId]
  );

  return totales;
};

/**
 * Verifica transiciones de estado válidas
 * Evita que una orden pagada vuelva a abierta, etc.
 */
const TRANSICIONES_VALIDAS = {
  abierta:    ['en_proceso', 'cancelada'],
  en_proceso: ['lista', 'cancelada'],
  lista:      ['entregada', 'cancelada'],
  entregada:  ['pagada', 'cancelada'],
  pagada:     [],       // Estado final — no puede cambiar
  cancelada:  [],       // Estado final — no puede cambiar
};

const validarTransicion = (estadoActual, estadoNuevo) => {
  const permitidos = TRANSICIONES_VALIDAS[estadoActual] || [];
  if (!permitidos.includes(estadoNuevo)) {
    throw {
      status: 400,
      mensaje: `No se puede cambiar de "${estadoActual}" a "${estadoNuevo}". Transiciones permitidas: ${permitidos.join(', ') || 'ninguna'}.`,
    };
  }
};

// ═════════════════════════════════════════════
// MESAS
// ═════════════════════════════════════════════

const listarMesas = async ({ tenantId, soloActivas = true }) => {
  const condicion = soloActivas
    ? 'WHERE tenant_id = $1 AND activo = TRUE'
    : 'WHERE tenant_id = $1';

  const { rows } = await query(
    `SELECT id, numero, nombre, capacidad, estado, activo, sucursal_id
     FROM mesas
     ${condicion}
     ORDER BY numero ASC`,
    [tenantId]
  );
  return rows;
};

const obtenerMesa = async ({ tenantId, mesaId }) => {
  const { rows } = await query(
    `SELECT id, numero, nombre, capacidad, estado, activo, sucursal_id
     FROM mesas WHERE id = $1 AND tenant_id = $2`,
    [mesaId, tenantId]
  );
  if (rows.length === 0) throw { status: 404, mensaje: 'Mesa no encontrada.' };
  return rows[0];
};

const crearMesa = async ({ tenantId, datos }) => {
  const { numero, nombre, capacidad, sucursal_id } = datos;

  const { rows } = await query(
    `INSERT INTO mesas (tenant_id, sucursal_id, numero, nombre, capacidad)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, numero, nombre, capacidad, estado, activo`,
    [tenantId, sucursal_id || null, numero, nombre || null, capacidad]
  );

  logger.info('Mesa creada', { tenant_id: tenantId, numero });
  return rows[0];
};

const actualizarMesa = async ({ tenantId, mesaId, datos }) => {
  await obtenerMesa({ tenantId, mesaId });

  const campos  = [];
  const valores = [];
  let idx = 1;

  if (datos.numero   !== undefined) { campos.push(`numero = $${idx++}`);   valores.push(datos.numero); }
  if (datos.nombre   !== undefined) { campos.push(`nombre = $${idx++}`);   valores.push(datos.nombre); }
  if (datos.capacidad !== undefined) { campos.push(`capacidad = $${idx++}`); valores.push(datos.capacidad); }
  if (datos.activo   !== undefined) { campos.push(`activo = $${idx++}`);   valores.push(datos.activo); }

  valores.push(mesaId, tenantId);

  const { rows } = await query(
    `UPDATE mesas SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, numero, nombre, capacidad, estado, activo`,
    valores
  );

  logger.info('Mesa actualizada', { mesa_id: mesaId });
  return rows[0];
};

const cambiarEstadoMesa = async ({ tenantId, mesaId, estado }) => {
  await obtenerMesa({ tenantId, mesaId });
  await query(
    'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
    [estado, mesaId, tenantId]
  );
};

// ═════════════════════════════════════════════
// ÓRDENES
// ═════════════════════════════════════════════

const listarOrdenes = async ({ tenantId, filtros = {} }) => {
  const { estado, tipo, usuario_id, fecha_desde, fecha_hasta, pagina = 1, limite = 50 } = filtros;

  const condiciones = ['o.tenant_id = $1'];
  const valores     = [tenantId];
  let idx = 2;

  if (estado)      { condiciones.push(`o.estado = $${idx++}`);      valores.push(estado); }
  if (tipo)        { condiciones.push(`o.tipo = $${idx++}`);        valores.push(tipo); }
  if (usuario_id)  { condiciones.push(`o.usuario_id = $${idx++}`);  valores.push(usuario_id); }
  if (fecha_desde) { condiciones.push(`o.creado_en >= $${idx++}`);  valores.push(fecha_desde); }
  if (fecha_hasta) { condiciones.push(`o.creado_en <= $${idx++}`);  valores.push(fecha_hasta); }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       o.id, o.tipo, o.estado, o.numero_orden,
       o.subtotal, o.porcentaje_descuento, o.descuento,
       o.total, o.gravado, o.iva, o.notas,
       o.mesa_id, o.cliente_id, o.usuario_id,
       o.creado_en, o.actualizado_en,
       m.numero AS mesa_numero,
       u.nombre AS usuario_nombre,
       COUNT(oi.id) AS total_items
     FROM ordenes o
     LEFT JOIN mesas m       ON m.id = o.mesa_id
     LEFT JOIN usuarios u    ON u.id = o.usuario_id
     LEFT JOIN orden_items oi ON oi.orden_id = o.id AND oi.estado != 'cancelado'
     WHERE ${condiciones.join(' AND ')}
     GROUP BY o.id, m.numero, u.nombre
     ORDER BY o.creado_en DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total FROM ordenes o WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    ordenes: rows,
    paginacion: {
      total:   parseInt(conteo[0].total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt(conteo[0].total) / limite),
    },
  };
};

const obtenerOrden = async ({ tenantId, ordenId }) => {
  // Obtener datos de la orden
  const { rows: ordenRows } = await query(
    `SELECT
       o.id, o.tipo, o.estado, o.numero_orden,
       o.subtotal, o.porcentaje_descuento, o.descuento,
       o.total, o.gravado, o.iva, o.notas,
       o.mesa_id, o.cliente_id, o.usuario_id,
       o.creado_en, o.actualizado_en, o.cerrado_en,
       m.numero AS mesa_numero,
       u.nombre AS usuario_nombre, u.rol AS usuario_rol
     FROM ordenes o
     LEFT JOIN mesas m    ON m.id = o.mesa_id
     LEFT JOIN usuarios u ON u.id = o.usuario_id
     WHERE o.id = $1 AND o.tenant_id = $2`,
    [ordenId, tenantId]
  );

  if (ordenRows.length === 0) throw { status: 404, mensaje: 'Orden no encontrada.' };

  // Obtener items de la orden
  const { rows: items } = await query(
    `SELECT
       id, producto_id, nombre_producto, precio_unitario,
       cantidad, subtotal, estado, notas, creado_en
     FROM orden_items
     WHERE orden_id = $1 AND tenant_id = $2
     ORDER BY creado_en ASC`,
    [ordenId, tenantId]
  );

  // Obtener pago si existe
  const { rows: pagos } = await query(
    `SELECT
       id, metodo, monto_efectivo, monto_tarjeta,
       total_pagado, vuelto, referencia_tarjeta, creado_en
     FROM pagos
     WHERE orden_id = $1 AND tenant_id = $2`,
    [ordenId, tenantId]
  );

  return {
    ...ordenRows[0],
    items,
    pago: pagos[0] || null,
  };
};

const crearOrden = async ({ tenantId, usuarioId, datos }) => {
  const { tipo, mesa_id, cliente_id, notas, porcentaje_descuento = 0 } = datos;

  // Si es orden de mesa, verificar que la mesa esté disponible
  if (tipo === 'mesa' && mesa_id) {
    const mesa = await obtenerMesa({ tenantId, mesaId: mesa_id });
    if (mesa.estado === 'ocupada') {
      throw { status: 409, mensaje: `La mesa ${mesa.numero} ya está ocupada.` };
    }
    if (!mesa.activo) {
      throw { status: 400, mensaje: `La mesa ${mesa.numero} está inactiva.` };
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Crear la orden
    const { rows } = await client.query(
      `INSERT INTO ordenes
         (tenant_id, tipo, mesa_id, cliente_id, usuario_id, notas, porcentaje_descuento)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         id, tipo, estado, numero_orden,
         subtotal, descuento, total, gravado, iva,
         mesa_id, cliente_id, usuario_id, notas,
         porcentaje_descuento, creado_en`,
      [
        tenantId,
        tipo,
        mesa_id   || null,
        cliente_id || null,
        usuarioId,
        notas     || null,
        porcentaje_descuento,
      ]
    );

    // Si es mesa, marcarla como ocupada
    if (tipo === 'mesa' && mesa_id) {
      await client.query(
        'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
        ['ocupada', mesa_id, tenantId]
      );
    }

    await client.query('COMMIT');

    logger.info('Orden creada', {
      orden_id:  rows[0].id,
      tipo,
      tenant_id: tenantId,
      usuario_id: usuarioId,
    });

    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const cambiarEstadoOrden = async ({ tenantId, ordenId, estado, motivo }) => {
  const orden = await obtenerOrden({ tenantId, ordenId });

  // Validar transición de estado
  validarTransicion(orden.estado, estado);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const cerradoEn = ['pagada', 'cancelada'].includes(estado) ? 'NOW()' : 'NULL';

    await client.query(
      `UPDATE ordenes SET estado = $1, cerrado_en = ${cerradoEn} WHERE id = $2`,
      [estado, ordenId]
    );

    // Si se cancela y tenía mesa, liberarla
    if (estado === 'cancelada' && orden.mesa_id) {
      await client.query(
        'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
        ['disponible', orden.mesa_id, tenantId]
      );
    }

    await client.query('COMMIT');

    logger.info('Estado de orden cambiado', {
      orden_id:       ordenId,
      estado_anterior: orden.estado,
      estado_nuevo:   estado,
      motivo,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const actualizarOrden = async ({ tenantId, ordenId, datos }) => {
  const orden = await obtenerOrden({ tenantId, ordenId });

  // No se puede modificar una orden cerrada
  if (['pagada', 'cancelada'].includes(orden.estado)) {
    throw { status: 400, mensaje: `No se puede modificar una orden en estado "${orden.estado}".` };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const campos  = [];
    const valores = [];
    let idx = 1;

    if (datos.notas !== undefined) {
      campos.push(`notas = $${idx++}`);
      valores.push(datos.notas);
    }
    if (datos.porcentaje_descuento !== undefined) {
      campos.push(`porcentaje_descuento = $${idx++}`);
      valores.push(datos.porcentaje_descuento);
    }

    if (campos.length > 0) {
      valores.push(ordenId);
      await client.query(
        `UPDATE ordenes SET ${campos.join(', ')} WHERE id = $${idx}`,
        valores
      );
    }

    // Recalcular totales si cambió el descuento
    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');
    return totales;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ═════════════════════════════════════════════
// ITEMS DE ORDEN
// ═════════════════════════════════════════════

const agregarItem = async ({ tenantId, ordenId, datos }) => {
  const orden = await obtenerOrden({ tenantId, ordenId });

  if (['pagada', 'cancelada'].includes(orden.estado)) {
    throw { status: 400, mensaje: `No se pueden agregar items a una orden "${orden.estado}".` };
  }

  // Obtener datos del producto — verificar que existe en el tenant
  const { rows: productoRows } = await query(
    `SELECT id, nombre, precio, activo, tiene_stock, stock_actual
     FROM productos
     WHERE id = $1 AND tenant_id = $2`,
    [datos.producto_id, tenantId]
  );

  if (productoRows.length === 0) {
    throw { status: 404, mensaje: 'Producto no encontrado.' };
  }

  const producto = productoRows[0];

  if (!producto.activo) {
    throw { status: 400, mensaje: `El producto "${producto.nombre}" no está disponible.` };
  }

  // Verificar stock si el producto lo maneja
  if (producto.tiene_stock && producto.stock_actual < datos.cantidad) {
    throw {
      status: 400,
      mensaje: `Stock insuficiente para "${producto.nombre}". Stock actual: ${producto.stock_actual}.`,
    };
  }

  const subtotalItem = Number((producto.precio * datos.cantidad).toFixed(2));

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Insertar item — snapshot del nombre y precio actual
    const { rows } = await client.query(
      `INSERT INTO orden_items
         (orden_id, tenant_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, estado, notas`,
      [
        ordenId,
        tenantId,
        producto.id,
        producto.nombre,
        producto.precio,
        datos.cantidad,
        subtotalItem,
        datos.notas || null,
      ]
    );

    // Descontar stock si aplica
    if (producto.tiene_stock) {
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2',
        [datos.cantidad, producto.id]
      );
    }

    // Recalcular totales de la orden
    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');

    logger.info('Item agregado a orden', {
      orden_id:   ordenId,
      producto:   producto.nombre,
      cantidad:   datos.cantidad,
      subtotal:   subtotalItem,
    });

    return { item: rows[0], totales };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const actualizarItem = async ({ tenantId, ordenId, itemId, datos }) => {
  const orden = await obtenerOrden({ tenantId, ordenId });

  if (['pagada', 'cancelada'].includes(orden.estado)) {
    throw { status: 400, mensaje: `No se pueden modificar items de una orden "${orden.estado}".` };
  }

  // Obtener item actual
  const { rows: itemRows } = await query(
    'SELECT * FROM orden_items WHERE id = $1 AND orden_id = $2 AND tenant_id = $3',
    [itemId, ordenId, tenantId]
  );

  if (itemRows.length === 0) throw { status: 404, mensaje: 'Item no encontrado.' };
  const itemActual = itemRows[0];

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const campos  = [];
    const valores = [];
    let idx = 1;

    // Si cambia la cantidad, actualizar subtotal y stock
    if (datos.cantidad !== undefined && datos.cantidad !== itemActual.cantidad) {
      const diferencia   = datos.cantidad - itemActual.cantidad;
      const nuevoSubtotal = Number((itemActual.precio_unitario * datos.cantidad).toFixed(2));

      campos.push(`cantidad = $${idx++}`, `subtotal = $${idx++}`);
      valores.push(datos.cantidad, nuevoSubtotal);

      // Ajustar stock si aplica
      const { rows: prodRows } = await client.query(
        'SELECT tiene_stock, stock_actual FROM productos WHERE id = $1',
        [itemActual.producto_id]
      );

      if (prodRows[0]?.tiene_stock) {
        if (diferencia > 0 && prodRows[0].stock_actual < diferencia) {
          throw {
            status: 400,
            mensaje: `Stock insuficiente. Stock actual: ${prodRows[0].stock_actual}.`,
          };
        }
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2',
          [diferencia, itemActual.producto_id]
        );
      }
    }

    if (datos.notas  !== undefined) { campos.push(`notas = $${idx++}`);  valores.push(datos.notas); }
    if (datos.estado !== undefined) { campos.push(`estado = $${idx++}`); valores.push(datos.estado); }

    if (campos.length > 0) {
      valores.push(itemId);
      await client.query(
        `UPDATE orden_items SET ${campos.join(', ')} WHERE id = $${idx}`,
        valores
      );
    }

    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');
    logger.info('Item actualizado', { item_id: itemId, orden_id: ordenId });
    return totales;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const eliminarItem = async ({ tenantId, ordenId, itemId }) => {
  const orden = await obtenerOrden({ tenantId, ordenId });

  if (['pagada', 'cancelada'].includes(orden.estado)) {
    throw { status: 400, mensaje: `No se pueden eliminar items de una orden "${orden.estado}".` };
  }

  const { rows: itemRows } = await query(
    'SELECT * FROM orden_items WHERE id = $1 AND orden_id = $2 AND tenant_id = $3',
    [itemId, ordenId, tenantId]
  );

  if (itemRows.length === 0) throw { status: 404, mensaje: 'Item no encontrado.' };
  const item = itemRows[0];

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Cancelar el item (soft delete — mantiene historial)
    await client.query(
      'UPDATE orden_items SET estado = $1 WHERE id = $2',
      ['cancelado', itemId]
    );

    // Devolver stock si aplica
    if (item.producto_id) {
      const { rows: prodRows } = await client.query(
        'SELECT tiene_stock FROM productos WHERE id = $1',
        [item.producto_id]
      );
      if (prodRows[0]?.tiene_stock) {
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2',
          [item.cantidad, item.producto_id]
        );
      }
    }

    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');
    logger.info('Item eliminado de orden', { item_id: itemId, orden_id: ordenId });
    return totales;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ═════════════════════════════════════════════
// PAGOS
// ═════════════════════════════════════════════

const registrarPago = async ({ tenantId, ordenId, usuarioId, datos }) => {
  const orden = await obtenerOrden({ tenantId, ordenId });

  if (orden.estado === 'pagada') {
    throw { status: 409, mensaje: 'Esta orden ya fue pagada.' };
  }
  if (orden.estado === 'cancelada') {
    throw { status: 400, mensaje: 'No se puede pagar una orden cancelada.' };
  }

  const { metodo, monto_efectivo = 0, monto_tarjeta = 0, referencia_tarjeta } = datos;

  // Validar que el total pagado cubra el total de la orden
  const totalPagado = Number((monto_efectivo + monto_tarjeta).toFixed(2));

  if (totalPagado < orden.total) {
    throw {
      status: 400,
      mensaje: `El monto pagado ($${totalPagado}) es menor al total de la orden ($${orden.total}).`,
    };
  }

  const vuelto = Number((totalPagado - orden.total).toFixed(2));

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Registrar el pago
    const { rows: pagoRows } = await client.query(
      `INSERT INTO pagos
         (orden_id, tenant_id, metodo, monto_efectivo, monto_tarjeta,
          total_pagado, vuelto, referencia_tarjeta, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, metodo, monto_efectivo, monto_tarjeta, total_pagado, vuelto, creado_en`,
      [
        ordenId, tenantId, metodo,
        monto_efectivo, monto_tarjeta,
        totalPagado, vuelto,
        referencia_tarjeta || null,
        usuarioId,
      ]
    );

    // Cambiar estado de la orden a pagada
    await client.query(
      'UPDATE ordenes SET estado = $1, cerrado_en = NOW() WHERE id = $2',
      ['pagada', ordenId]
    );

    // Liberar mesa si aplica
    if (orden.mesa_id) {
      await client.query(
        'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
        ['disponible', orden.mesa_id, tenantId]
      );
    }

    await client.query('COMMIT');

    logger.info('Pago registrado', {
      orden_id:     ordenId,
      metodo,
      total_pagado: totalPagado,
      vuelto,
    });

    return {
      pago:  pagoRows[0],
      orden: { ...orden, estado: 'pagada', total: orden.total },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  // Mesas
  listarMesas,
  obtenerMesa,
  crearMesa,
  actualizarMesa,
  cambiarEstadoMesa,
  // Órdenes
  listarOrdenes,
  obtenerOrden,
  crearOrden,
  cambiarEstadoOrden,
  actualizarOrden,
  // Items
  agregarItem,
  actualizarItem,
  eliminarItem,
  // Pagos
  registrarPago,
};
