// src/modules/caja/caja.service.js
// Lógica de negocio del módulo de caja
// Principio S (SOLID): solo opera con datos, no valida ni responde HTTP
// Principio O (SOLID): extensible sin modificar métodos existentes

const { query, getClient } = require('../../config/database');
const logger               = require('../../utils/logger');

// ─────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────

/**
 * Obtiene la caja actualmente abierta del tenant
 * IMPORTANTE: todos los campos del WHERE usan alias c.
 * para evitar ambigüedad con el JOIN a usuarios
 */
const obtenerCajaAbierta = async ({ tenantId, sucursalId = null }) => {
  // Usar alias c. en todas las condiciones para evitar ambigüedad con el JOIN
  const condiciones = ["c.tenant_id = $1", "c.estado = 'abierta'"];
  const valores     = [tenantId];
  let idx = 2;

  if (sucursalId) {
    condiciones.push(`c.sucursal_id = $${idx++}`);
    valores.push(sucursalId);
  }

  const { rows } = await query(
    `SELECT
       c.id, c.tenant_id, c.sucursal_id, c.estado,
       c.monto_inicial, c.total_esperado,
       c.total_ventas, c.total_efectivo, c.total_tarjeta,
       c.total_retiros, c.total_depositos,
       c.fecha_apertura,
       c.usuario_apertura_id,
       u.nombre AS usuario_apertura_nombre
     FROM cajas c
     JOIN usuarios u ON u.id = c.usuario_apertura_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY c.fecha_apertura DESC
     LIMIT 1`,
    valores
  );

  return rows[0] || null;
};

/**
 * Recalcula los totales de la caja sumando todos sus movimientos
 * Se llama después de cada pago o movimiento manual
 * Usa alias mc. en subqueries para evitar ambigüedad
 */
const recalcularTotalesCaja = async (client, cajaId) => {
  await client.query(
    `UPDATE cajas SET
       total_ventas    = COALESCE((
         SELECT SUM(mc.monto) FROM movimientos_caja mc
         WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso'
       ), 0),
       total_efectivo  = COALESCE((
         SELECT SUM(mc.monto) FROM movimientos_caja mc
         WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'efectivo'
       ), 0),
       total_tarjeta   = COALESCE((
         SELECT SUM(mc.monto) FROM movimientos_caja mc
         WHERE mc.caja_id = $1 AND mc.tipo = 'ingreso' AND mc.metodo_pago = 'tarjeta'
       ), 0),
       total_retiros   = COALESCE((
         SELECT SUM(mc.monto) FROM movimientos_caja mc
         WHERE mc.caja_id = $1 AND mc.tipo = 'retiro'
       ), 0),
       total_depositos = COALESCE((
         SELECT SUM(mc.monto) FROM movimientos_caja mc
         WHERE mc.caja_id = $1 AND mc.tipo = 'deposito'
       ), 0),
       total_esperado  = cajas.monto_inicial + COALESCE((
         SELECT SUM(CASE
           WHEN mc.tipo = 'ingreso'  AND mc.metodo_pago = 'efectivo' THEN mc.monto
           WHEN mc.tipo = 'deposito' THEN mc.monto
           WHEN mc.tipo = 'retiro'   THEN -mc.monto
           ELSE 0
         END) FROM movimientos_caja mc WHERE mc.caja_id = $1
       ), 0)
     WHERE cajas.id = $1`,
    [cajaId]
  );
};

// ═════════════════════════════════════════════
// MÉTODOS DEL SERVICE
// ═════════════════════════════════════════════

/**
 * Abrir una nueva caja
 * Solo puede haber una caja abierta por tenant/sucursal
 */
const abrirCaja = async ({ tenantId, usuarioId, datos }) => {
  const { monto_inicial, sucursal_id } = datos;

  // Verificar que no haya una caja abierta
  const cajaAbierta = await obtenerCajaAbierta({ tenantId, sucursalId: sucursal_id });
  if (cajaAbierta) {
    throw {
      status: 409,
      mensaje: `Ya hay una caja abierta desde ${new Date(cajaAbierta.fecha_apertura).toLocaleString('es-SV')}. Ciérrala antes de abrir una nueva.`,
    };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO cajas
         (tenant_id, sucursal_id, usuario_apertura_id, monto_inicial, total_esperado)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING
         id, tenant_id, sucursal_id, estado,
         monto_inicial, total_esperado,
         total_ventas, total_efectivo, total_tarjeta,
         total_retiros, total_depositos,
         fecha_apertura, usuario_apertura_id`,
      [tenantId, sucursal_id || null, usuarioId, monto_inicial]
    );

    await client.query('COMMIT');

    logger.info('Caja abierta', {
      caja_id:       rows[0].id,
      tenant_id:     tenantId,
      usuario_id:    usuarioId,
      monto_inicial,
    });

    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Obtener la caja activa del tenant
 * Incluye resumen de los últimos movimientos del turno
 */
const getCajaActiva = async ({ tenantId, sucursalId = null }) => {
  const caja = await obtenerCajaAbierta({ tenantId, sucursalId });

  if (!caja) {
    throw { status: 404, mensaje: 'No hay ninguna caja abierta en este momento.' };
  }

  // Últimos 10 movimientos del turno
  const { rows: movimientos } = await query(
    `SELECT
       m.id, m.tipo, m.monto, m.motivo,
       m.metodo_pago, m.orden_id, m.creado_en,
       u.nombre AS usuario_nombre
     FROM movimientos_caja m
     JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.caja_id = $1
     ORDER BY m.creado_en DESC
     LIMIT 10`,
    [caja.id]
  );

  return { ...caja, movimientos_recientes: movimientos };
};

/**
 * Cerrar la caja activa
 * El cajero ingresa el monto contado físicamente
 * El sistema calcula la diferencia vs lo esperado
 */
const cerrarCaja = async ({ tenantId, usuarioId, datos }) => {
  const { monto_final, notas_cierre, sucursal_id } = datos;
  const caja = await obtenerCajaAbierta({ tenantId, sucursalId: sucursal_id });

  if (!caja) {
    throw { status: 404, mensaje: 'No hay ninguna caja abierta para cerrar.' };
  }

  const diferencia = Number((monto_final - caja.total_esperado).toFixed(2));

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE cajas SET
         estado            = 'cerrada',
         monto_final       = $1,
         diferencia        = $2,
         notas_cierre      = $3,
         usuario_cierre_id = $4,
         fecha_cierre      = NOW()
       WHERE id = $5
       RETURNING
         id, estado, monto_inicial, total_esperado,
         monto_final, diferencia,
         total_ventas, total_efectivo, total_tarjeta,
         total_retiros, total_depositos,
         notas_cierre, fecha_apertura, fecha_cierre`,
      [monto_final, diferencia, notas_cierre || null, usuarioId, caja.id]
    );

    await client.query('COMMIT');

    logger.info('Caja cerrada', {
      caja_id:        caja.id,
      tenant_id:      tenantId,
      usuario_id:     usuarioId,
      monto_final,
      total_esperado: caja.total_esperado,
      diferencia,
    });

    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Registrar un movimiento manual (retiro o depósito)
 * Los ingresos se registran automáticamente al pagar órdenes
 */
const registrarMovimiento = async ({ tenantId, usuarioId, datos }) => {
  const { tipo, monto, motivo, sucursal_id } = datos;
  if (!sucursal_id) {
    throw { status: 400, mensaje: 'sucursal_id es obligatorio.' };
  }
  const caja = await obtenerCajaAbierta({ tenantId, sucursalId: sucursal_id });


  if (!caja) {
    throw { status: 404, mensaje: 'No hay ninguna caja abierta para registrar movimientos.' };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO movimientos_caja
         (caja_id, tenant_id, tipo, monto, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tipo, monto, motivo, creado_en`,
      [caja.id, tenantId, tipo, monto, motivo, usuarioId]
    );

    await recalcularTotalesCaja(client, caja.id);

    await client.query('COMMIT');

    logger.info('Movimiento de caja registrado', {
      caja_id: caja.id,
      tipo,
      monto,
      motivo,
    });

    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Registrar ingreso automático al pagar una orden
 * Lo llama el módulo POS después de registrar un pago exitoso
 */
const registrarIngresoPago = async ({ client, tenantId, cajaId, ordenId, monto, metodoPago, usuarioId }) => {
  await client.query(
    `INSERT INTO movimientos_caja
       (caja_id, tenant_id, tipo, monto, motivo, usuario_id, orden_id, metodo_pago)
     VALUES ($1, $2, 'ingreso', $3, $4, $5, $6, $7)`,
    [cajaId, tenantId, monto, `Pago orden #${ordenId}`, usuarioId, ordenId, metodoPago]
  );

  await recalcularTotalesCaja(client, cajaId);
};

/**
 * Obtener historial de movimientos de una caja
 */
const getMovimientos = async ({ tenantId, cajaId, pagina = 1, limite = 50 }) => {
  const { rows: cajaRows } = await query(
    'SELECT id FROM cajas WHERE id = $1 AND tenant_id = $2',
    [cajaId, tenantId]
  );
  if (cajaRows.length === 0) throw { status: 404, mensaje: 'Caja no encontrada.' };

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       m.id, m.tipo, m.monto, m.motivo,
       m.metodo_pago, m.orden_id, m.creado_en,
       u.nombre AS usuario_nombre
     FROM movimientos_caja m
     JOIN usuarios u ON u.id = m.usuario_id
     WHERE m.caja_id = $1 AND m.tenant_id = $2
     ORDER BY m.creado_en DESC
     LIMIT $3 OFFSET $4`,
    [cajaId, tenantId, limite, offset]
  );

  const { rows: conteo } = await query(
    'SELECT COUNT(*) as total FROM movimientos_caja WHERE caja_id = $1 AND tenant_id = $2',
    [cajaId, tenantId]
  );

  return {
    movimientos: rows,
    paginacion: {
      total:   parseInt(conteo[0].total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt(conteo[0].total) / limite),
    },
  };
};

/**
 * Historial de cajas anteriores con resumen
 */
const getHistorialCajas = async ({ tenantId, filtros = {} }) => {
  const { estado, fecha_desde, fecha_hasta, pagina = 1, limite = 20 } = filtros;

  const condiciones = ['c.tenant_id = $1'];
  const valores     = [tenantId];
  let idx = 2;

  if (estado)      { condiciones.push(`c.estado = $${idx++}`);           valores.push(estado); }
  if (fecha_desde) { condiciones.push(`c.fecha_apertura >= $${idx++}`);  valores.push(fecha_desde); }
  if (fecha_hasta) { condiciones.push(`c.fecha_apertura <= $${idx++}`);  valores.push(fecha_hasta); }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       c.id, c.estado,
       c.monto_inicial, c.total_esperado, c.monto_final, c.diferencia,
       c.total_ventas, c.total_efectivo, c.total_tarjeta,
       c.total_retiros, c.total_depositos,
       c.fecha_apertura, c.fecha_cierre,
       ua.nombre AS usuario_apertura,
       uc.nombre AS usuario_cierre
     FROM cajas c
     JOIN usuarios ua ON ua.id = c.usuario_apertura_id
     LEFT JOIN usuarios uc ON uc.id = c.usuario_cierre_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY c.fecha_apertura DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total FROM cajas c WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    cajas: rows,
    paginacion: {
      total:   parseInt(conteo[0].total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt(conteo[0].total) / limite),
    },
  };
};

module.exports = {
  abrirCaja,
  getCajaActiva,
  cerrarCaja,
  registrarMovimiento,
  registrarIngresoPago,
  getMovimientos,
  getHistorialCajas,
  obtenerCajaAbierta,
};
