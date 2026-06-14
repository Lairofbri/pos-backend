// src/modules/pos/pos.service.js
// Lógica de negocio del módulo POS
// Principio S (SOLID): solo opera con datos, no valida ni responde HTTP
// Principio O (SOLID): extensible sin modificar métodos existentes

const { query, getClient } = require('../../config/database');
const logger               = require('../../utils/logger');
const { ESTADOS_FINALES, TASA_IVA } = require('../../utils/constants');

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
    `SELECT COALESCE(SUM(subtotal - (subtotal * COALESCE(descuento_porcentaje, 0) / 100)), 0) as subtotal
     FROM orden_items
     WHERE orden_id = $1 AND tenant_id = $2 AND estado != 'cancelado'`,
    [ordenId, tenantId]
  );

  const { rows: ordenRows } = await client.query(
    'SELECT porcentaje_descuento FROM ordenes WHERE id = $1 AND tenant_id = $2',
    [ordenId, tenantId]
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
     WHERE id = $6 AND tenant_id = $7`,
    [totales.subtotal, totales.descuento, totales.total, totales.gravado, totales.iva, ordenId, tenantId]
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
  entregada:  ESTADOS_FINALES,
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

/**
 * Adjunta la orden activa (si existe) a una mesa
 * Acepta un array o un objeto individual — devuelve el mismo tipo
 */
const adjuntarOrdenActiva = async (mesas, tenantId) => {
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

  const ordenPorMesa = {};
  for (const o of ordenes) {
    ordenPorMesa[o.mesa_id] = { id: o.orden_id, creado_en: o.orden_creada_en, total: o.orden_total };
  }

  for (const mesa of lista) {
    mesa.orden_activa = ordenPorMesa[mesa.id] || null;
  }

  return mesas;
};

const listarMesas = async ({ tenantId, soloActivas = true }) => {
  const condicion = soloActivas
    ? 'WHERE tenant_id = $1 AND activo = TRUE'
    : 'WHERE tenant_id = $1';

  const { rows } = await query(
    `SELECT id, numero, nombre, capacidad, estado, activo, sucursal_id, zona
     FROM mesas
     ${condicion}
     ORDER BY numero ASC`,
    [tenantId]
  );

  await adjuntarOrdenActiva(rows, tenantId);
  return rows;
};

const obtenerMesa = async ({ tenantId, mesaId }) => {
  const { rows } = await query(
    `SELECT id, numero, nombre, capacidad, estado, activo, sucursal_id, zona
     FROM mesas WHERE id = $1 AND tenant_id = $2`,
    [mesaId, tenantId]
  );
  if (rows.length === 0) throw { status: 404, mensaje: 'Mesa no encontrada.' };
  await adjuntarOrdenActiva(rows[0], tenantId);
  return rows[0];
};

const crearMesa = async ({ tenantId, datos }) => {
  const { numero, nombre, capacidad, zona, sucursal_id } = datos;

  const { rows } = await query(
    `INSERT INTO mesas (tenant_id, sucursal_id, numero, nombre, capacidad, zona)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, numero, nombre, capacidad, estado, activo, zona`,
    [tenantId, sucursal_id || null, numero, nombre || null, capacidad, zona || 'salon']
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
  if (datos.zona     !== undefined) { campos.push(`zona = $${idx++}`);     valores.push(datos.zona); }
  if (datos.activo   !== undefined) { campos.push(`activo = $${idx++}`);   valores.push(datos.activo); }
  if (datos.estado   !== undefined) { campos.push(`estado = $${idx++}`);   valores.push(datos.estado); }

  valores.push(mesaId, tenantId);

  const { rows } = await query(
    `UPDATE mesas SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, numero, nombre, capacidad, estado, activo, zona`,
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
  const { estado, tipo, origen, usuario_id, fecha_desde, fecha_hasta, activas, pagina = 1, limite = 50 } = filtros;

  const condiciones = ['o.tenant_id = $1'];
  const valores     = [tenantId];
  let idx = 2;

  if (estado)      { condiciones.push(`o.estado = $${idx++}`);      valores.push(estado); }
  if (tipo)        { condiciones.push(`o.tipo = $${idx++}`);        valores.push(tipo); }
  if (origen)      { condiciones.push(`o.origen = $${idx++}`);      valores.push(origen); }
  if (usuario_id)  { condiciones.push(`o.usuario_id = $${idx++}`);  valores.push(usuario_id); }
  if (fecha_desde) { condiciones.push(`o.creado_en >= $${idx++}`);  valores.push(fecha_desde); }
  if (fecha_hasta) { condiciones.push(`o.creado_en <= $${idx++}`);  valores.push(fecha_hasta); }
  if (activas)     { condiciones.push(`o.estado NOT IN (${ESTADOS_FINALES.map(e => `'${e}'`).join(',')})`); }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       o.id, o.tipo, o.estado, o.numero_orden, o.origen, o.numero_externo,
       o.subtotal, o.porcentaje_descuento, o.descuento,
       o.total, o.gravado, o.iva, o.notas,
      o.mesa_id, o.cliente_id, o.usuario_id,
        o.creado_en, o.actualizado_en,
        m.numero AS mesa_numero, m.zona,
        CONCAT_WS(' ', c.nombre, c.apellido) AS cliente_nombre,
        u.nombre AS usuario_nombre,
        COUNT(oi.id) AS total_items
      FROM ordenes o
      LEFT JOIN mesas m       ON m.id = o.mesa_id
      LEFT JOIN clientes c    ON c.id = o.cliente_id
      LEFT JOIN usuarios u    ON u.id = o.usuario_id
      LEFT JOIN orden_items oi ON oi.orden_id = o.id AND oi.estado != 'cancelado'
     WHERE ${condiciones.join(' AND ')}
     GROUP BY o.id, m.numero, m.zona, c.nombre, c.apellido, u.nombre
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
       o.id, o.tipo, o.estado, o.numero_orden, o.origen, o.numero_externo,
        o.subtotal, o.porcentaje_descuento, o.descuento,
        o.total, o.gravado, o.iva, o.notas,
        o.mesa_id, o.cliente_id, o.usuario_id,
        o.creado_en, o.actualizado_en, o.cerrado_en,
        m.numero AS mesa_numero, m.zona,
        CONCAT_WS(' ', c.nombre, c.apellido) AS cliente_nombre,
        u.nombre AS usuario_nombre, u.rol AS usuario_rol
      FROM ordenes o
      LEFT JOIN mesas m     ON m.id = o.mesa_id
      LEFT JOIN clientes c  ON c.id = o.cliente_id
      LEFT JOIN usuarios u  ON u.id = o.usuario_id
     WHERE o.id = $1 AND o.tenant_id = $2`,
    [ordenId, tenantId]
  );

  if (ordenRows.length === 0) throw { status: 404, mensaje: 'Orden no encontrada.' };

  // Obtener items de la orden
  const { rows: items } = await query(
    `SELECT
       id, producto_id, nombre_producto AS nombre, precio_unitario,
        cantidad, subtotal, COALESCE(descuento_porcentaje, 0) as descuento_porcentaje,
        (subtotal - (subtotal * COALESCE(descuento_porcentaje, 0) / 100)) as subtotal_con_descuento,
        estado, notas, enviado_en, creado_en
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
    pagos,
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
         (tenant_id, tipo, mesa_id, cliente_id, usuario_id, notas, porcentaje_descuento, origen, numero_externo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING
         id, tipo, estado, numero_orden, origen, numero_externo,
         subtotal, descuento, total, gravado, iva,
         mesa_id, cliente_id, usuario_id, notas,
         porcentaje_descuento, creado_en`,
      [
        tenantId,
        tipo,
        mesa_id        || null,
        cliente_id     || null,
        usuarioId,
        notas          || null,
        porcentaje_descuento,
        datos.origen   || 'pos',
        datos.numero_externo || null,
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

    return { ...rows[0], items: [] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const cambiarEstadoOrden = async ({ tenantId, ordenId, estado, motivo, usuarioId }) => {
  const orden = await obtenerOrden({ tenantId, ordenId });

  // Validar transición de estado
  validarTransicion(orden.estado, estado);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const cerradoEn = ESTADOS_FINALES.includes(estado) ? 'NOW()' : 'NULL';

    await client.query(
      `UPDATE ordenes SET estado = $1, cerrado_en = ${cerradoEn} WHERE id = $2 AND tenant_id = $3`,
      [estado, ordenId, tenantId]
    );

    // Si se envía a cocina, cambiar todos los items pendientes a en_proceso
    let itemsEnviados = [];
    if (estado === 'en_proceso') {
      const { rows } = await client.query(
        `UPDATE orden_items SET estado = 'en_proceso', enviado_en = NOW(), enviado_por = $1
         WHERE orden_id = $2 AND tenant_id = $3 AND estado = 'pendiente'
         RETURNING id, producto_id, nombre_producto, cantidad, notas`,
        [usuarioId, ordenId, tenantId]
      );
      itemsEnviados = rows;
    }

    // Si se cancela y tenía mesa, liberarla
    if (estado === 'cancelada' && orden.mesa_id) {
      await client.query(
        'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
        ['disponible', orden.mesa_id, tenantId]
      );
    }

    await client.query('COMMIT');

    if (estado === 'en_proceso' && itemsEnviados.length > 0) {
      try {
        const { io } = require('../../server');
        const sala = `tenant:${tenantId}`;
        for (const item of itemsEnviados) {
          io.to(sala).emit('cocina:nuevo-item', {
            item_id: item.id,
            orden_id: ordenId,
            nombre_producto: item.nombre_producto,
            cantidad: item.cantidad,
            notas: item.notas,
          });
        }
      } catch (_e) { /* socket.io no disponible */ }
    }

    if (estado === 'pagada') {
      try {
        const { io } = require('../../server');
        io.to(`tenant:${tenantId}`).emit('cocina:orden-completada', {
          orden_id: ordenId,
          numero_orden: orden.numero_orden,
        });
      } catch (_e) { /* socket.io no disponible */ }
    }

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
  if (ESTADOS_FINALES.includes(orden.estado)) {
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
      valores.push(ordenId, tenantId);
      await client.query(
        `UPDATE ordenes SET ${campos.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}`,
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

  if (ESTADOS_FINALES.includes(orden.estado)) {
    throw { status: 400, mensaje: `No se pueden agregar items a una orden "${orden.estado}".` };
  }

  // Verificar si es un combo
  const { rows: comboRows } = await query(
    'SELECT id, nombre, precio, activo FROM combos WHERE id = $1 AND tenant_id = $2',
    [datos.producto_id, tenantId]
  );

  if (comboRows.length > 0) {
    return agregarComboAOrden({ tenantId, ordenId, datos, combo: comboRows[0], orden });
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
         (orden_id, tenant_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, notas, descuento_porcentaje)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, descuento_porcentaje, estado, notas`,
      [
        ordenId,
        tenantId,
        producto.id,
        producto.nombre,
        producto.precio,
        datos.cantidad,
        subtotalItem,
        datos.notas || null,
        datos.descuento_porcentaje ?? 0,
      ]
    );

    // Descontar stock si aplica
    if (producto.tiene_stock) {
      await client.query(
        'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND tenant_id = $3',
          [datos.cantidad, producto.id, tenantId]
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

/**
 * Expande un combo en items individuales dentro de la orden
 */
const agregarComboAOrden = async ({ tenantId, ordenId, datos, combo }) => {
  const { rows: componentes } = await query(
    `SELECT cp.producto_id, cp.cantidad, p.nombre, p.precio, p.tiene_stock, p.stock_actual, p.activo
     FROM combo_productos cp
     JOIN productos p ON p.id = cp.producto_id
     WHERE cp.combo_id = $1`,
    [combo.id]
  );

  if (componentes.length === 0) {
    throw { status: 400, mensaje: `El combo "${combo.nombre}" no tiene productos asignados.` };
  }

  // Verificar stock y disponibilidad de cada componente
  for (const c of componentes) {
    if (!c.activo) {
      throw { status: 400, mensaje: `"${c.nombre}" no está disponible actualmente.` };
    }
    const cantidadTotal = c.cantidad * datos.cantidad;
    if (c.tiene_stock && c.stock_actual < cantidadTotal) {
      throw {
        status: 400,
        mensaje: `Stock insuficiente para "${c.nombre}". Necesita ${cantidadTotal}, hay ${c.stock_actual}.`,
      };
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const itemsInsertados = [];

    for (const c of componentes) {
      const cantidadTotal = c.cantidad * datos.cantidad;
      const subtotal = Number((c.precio * cantidadTotal).toFixed(2));

      const { rows } = await client.query(
        `INSERT INTO orden_items
           (orden_id, tenant_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, notas, descuento_porcentaje)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, producto_id, nombre_producto AS nombre, precio_unitario, cantidad, subtotal, descuento_porcentaje, estado, notas`,
        [
          ordenId, tenantId, c.producto_id, c.nombre, c.precio,
          cantidadTotal, subtotal, datos.notas || null, datos.descuento_porcentaje ?? 0,
        ]
      );

      if (c.tiene_stock) {
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND tenant_id = $3',
          [cantidadTotal, c.producto_id, tenantId]
        );
      }

      itemsInsertados.push(rows[0]);
    }

    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');

    logger.info('Combo agregado a orden', {
      orden_id: ordenId,
      combo: combo.nombre,
      items: componentes.length,
    });

    return { items: itemsInsertados, totales, es_combo: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const actualizarItem = async ({ tenantId, ordenId, itemId, usuarioId, datos }) => {
  const orden = await obtenerOrden({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(orden.estado)) {
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
        'SELECT tiene_stock, stock_actual FROM productos WHERE id = $1 AND tenant_id = $2',
        [itemActual.producto_id, tenantId]
      );

      if (prodRows[0]?.tiene_stock) {
        if (diferencia > 0 && prodRows[0].stock_actual < diferencia) {
          throw {
            status: 400,
            mensaje: `Stock insuficiente. Stock actual: ${prodRows[0].stock_actual}.`,
          };
        }
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual - $1 WHERE id = $2 AND tenant_id = $3',
          [diferencia, itemActual.producto_id, tenantId]
        );
      }
    }

    if (datos.notas  !== undefined) { campos.push(`notas = $${idx++}`);  valores.push(datos.notas); }
    if (datos.estado !== undefined) {
      campos.push(`estado = $${idx++}`);
      valores.push(datos.estado);
      // Si se envía a cocina, registrar timestamp y quien lo envió
      if (datos.estado === 'en_proceso' && itemActual.estado !== 'en_proceso') {
        campos.push(`enviado_en = $${idx++}`, `enviado_por = $${idx++}`);
        valores.push(new Date(), usuarioId);
      }
    }
    if (datos.descuento_porcentaje !== undefined) { campos.push(`descuento_porcentaje = $${idx++}`); valores.push(datos.descuento_porcentaje); }

    if (campos.length > 0) {
      valores.push(itemId, tenantId);
      await client.query(
        `UPDATE orden_items SET ${campos.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}`,
        valores
      );
    }

    const totales = await recalcularOrden(client, ordenId, tenantId);

    await client.query('COMMIT');

    // Emitir evento socket.io para cocina si cambió estado
    if (datos.estado) {
      try {
        const { io } = require('../../server');
        const sala = `tenant:${tenantId}`;
        if (datos.estado === 'en_proceso' && itemActual.estado !== 'en_proceso') {
          io.to(sala).emit('cocina:nuevo-item', {
            item_id: itemId,
            orden_id: ordenId,
            nombre_producto: itemActual.nombre_producto,
            cantidad: datos.cantidad || itemActual.cantidad,
            notas: datos.notas || itemActual.notas,
          });
        }
        if (datos.estado === 'listo' && itemActual.estado !== 'listo') {
          io.to(sala).emit('cocina:item-listo', {
            item_id: itemId,
            orden_id: ordenId,
            nombre_producto: itemActual.nombre_producto,
          });
        }
      } catch (_e) { /* socket.io no disponible */ }
    }

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

  if (ESTADOS_FINALES.includes(orden.estado)) {
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
      'UPDATE orden_items SET estado = $1 WHERE id = $2 AND tenant_id = $3',
      ['cancelado', itemId, tenantId]
    );

    // Devolver stock si aplica
    if (item.producto_id) {
      const { rows: prodRows } = await client.query(
        'SELECT tiene_stock FROM productos WHERE id = $1 AND tenant_id = $2',
        [item.producto_id, tenantId]
      );
      if (prodRows[0]?.tiene_stock) {
        await client.query(
          'UPDATE productos SET stock_actual = stock_actual + $1 WHERE id = $2 AND tenant_id = $3',
          [item.cantidad, item.producto_id, tenantId]
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
// DIVIDIR CUENTA Y TRANSFERIR ITEMS
// ═════════════════════════════════════════════

const moveItemsBetweenOrders = async ({ tenantId, ordenOrigenId, items, ordenDestinoId }) => {
  // Verificar que los items pertenezcan a la orden origen
  const { rows: itemsVerificar } = await query(
    `SELECT id, estado FROM orden_items
     WHERE id = ANY($1::uuid[]) AND orden_id = $2 AND tenant_id = $3`,
    [items, ordenOrigenId, tenantId]
  );

  if (itemsVerificar.length !== items.length) {
    throw { status: 400, mensaje: 'Uno o más items no pertenecen a la orden origen o no existen.' };
  }

  // Verificar que ningún item esté cancelado
  for (const item of itemsVerificar) {
    if (item.estado === 'cancelado') {
      throw { status: 400, mensaje: 'No se pueden mover items cancelados.' };
    }
  }
};

/**
 * POST /ordenes/:id/split
 * Crea una nueva orden y mueve los items seleccionados a ella
 */
const splitOrden = async ({ tenantId, usuarioId, ordenId, datos }) => {
  const orden = await obtenerOrden({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(orden.estado)) {
    throw { status: 400, mensaje: `No se puede dividir una orden "${orden.estado}".` };
  }

  if (orden.items.length <= 1) {
    throw { status: 400, mensaje: 'La orden debe tener al menos 2 items para dividir.' };
  }

  const { items: itemIds, tipo, mesa_id, notas } = datos;

  await moveItemsBetweenOrders({ tenantId, ordenOrigenId: ordenId, items: itemIds });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Crear nueva orden
    const { rows: ordenRows } = await client.query(
      `INSERT INTO ordenes
         (tenant_id, tipo, mesa_id, usuario_id, notas)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tipo, estado, numero_orden, creado_en`,
      [tenantId, tipo || 'rapido', mesa_id || null, usuarioId, notas || null]
    );

    const nuevaOrdenId = ordenRows[0].id;

    // Mover los items seleccionados a la nueva orden
    await client.query(
      'UPDATE orden_items SET orden_id = $1 WHERE id = ANY($2::uuid[]) AND tenant_id = $3',
      [nuevaOrdenId, itemIds, tenantId]
    );

    // Recalcular ambas órdenes
    const totalesOrigen = await recalcularOrden(client, ordenId, tenantId);
    const totalesDestino = await recalcularOrden(client, nuevaOrdenId, tenantId);

    await client.query('COMMIT');

    logger.info('Orden dividida', {
      orden_origen: ordenId,
      nueva_orden: nuevaOrdenId,
      items_movidos: itemIds.length,
    });

    return {
      orden_original: { id: ordenId, ...totalesOrigen },
      nueva_orden: { id: nuevaOrdenId, ...ordenRows[0], ...totalesDestino },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * POST /ordenes/:id/transferir
 * Mueve items a una orden existente
 */
const transferirItems = async ({ tenantId, ordenId, datos }) => {
  const ordenOrigen = await obtenerOrden({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(ordenOrigen.estado)) {
    throw { status: 400, mensaje: `No se puede transferir desde una orden "${ordenOrigen.estado}".` };
  }

  const ordenDestino = await obtenerOrden({ tenantId, ordenId: datos.orden_destino_id });

  if (ESTADOS_FINALES.includes(ordenDestino.estado)) {
    throw { status: 400, mensaje: `No se puede transferir a una orden "${ordenDestino.estado}".` };
  }

  const { items: itemIds, orden_destino_id } = datos;

  await moveItemsBetweenOrders({ tenantId, ordenOrigenId: ordenId, items: itemIds });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Mover los items
    await client.query(
      'UPDATE orden_items SET orden_id = $1 WHERE id = ANY($2::uuid[]) AND tenant_id = $3',
      [orden_destino_id, itemIds, tenantId]
    );

    // Recalcular ambas órdenes
    const totalesOrigen = await recalcularOrden(client, ordenId, tenantId);
    const totalesDestino = await recalcularOrden(client, orden_destino_id, tenantId);

    await client.query('COMMIT');

    logger.info('Items transferidos', {
      orden_origen: ordenId,
      orden_destino: orden_destino_id,
      items_movidos: itemIds.length,
    });

    return {
      orden_origen: { id: ordenId, ...totalesOrigen },
      orden_destino: { id: orden_destino_id, ...totalesDestino },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ═════════════════════════════════════════════
// CAMBIAR MESA DE UNA ORDEN
// ═════════════════════════════════════════════

/**
 * PATCH /ordenes/:id/cambiar-mesa
 * Cambia la mesa asignada a una orden
 */
const cambiarMesa = async ({ tenantId, ordenId, mesaId }) => {
  const orden = await obtenerOrden({ tenantId, ordenId });

  if (ESTADOS_FINALES.includes(orden.estado)) {
    throw { status: 400, mensaje: `No se puede cambiar de mesa una orden "${orden.estado}".` };
  }

  // Verificar que la mesa destino existe y está disponible
  const mesaDestino = await obtenerMesa({ tenantId, mesaId });

  if (!mesaDestino.activo) {
    throw { status: 400, mensaje: `La mesa "${mesaDestino.nombre}" está inactiva.` };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Liberar mesa anterior
    if (orden.mesa_id) {
      await client.query(
        'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
        ['disponible', orden.mesa_id, tenantId]
      );
    }

    // Asignar nueva mesa
    await client.query(
      'UPDATE ordenes SET mesa_id = $1 WHERE id = $2 AND tenant_id = $3',
      [mesaId, ordenId, tenantId]
    );

    // Marcar mesa como ocupada
    await client.query(
      'UPDATE mesas SET estado = $1 WHERE id = $2 AND tenant_id = $3',
      ['ocupada', mesaId, tenantId]
    );

    await client.query('COMMIT');

    logger.info('Mesa cambiada', {
      orden_id: ordenId,
      mesa_anterior: orden.mesa_id,
      mesa_nueva: mesaId,
    });

    return { orden_id: ordenId, mesa_id: mesaId };
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

    try {
      const { io } = require('../../server');
      io.to(`tenant:${tenantId}`).emit('cocina:orden-completada', {
        orden_id: ordenId,
        numero_orden: orden.numero_orden,
      });
    } catch (_e) { /* socket.io no disponible */ }

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
  // Split y transferir
  splitOrden,
  transferirItems,
  // Cambiar mesa
  cambiarMesa,
  // Pagos
  registrarPago,
};
