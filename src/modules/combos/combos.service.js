// src/modules/combos/combos.service.js
// Lógica de negocio del módulo de combos

const { query } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Listar combos del tenant
 */
const listarCombos = async ({ tenantId, soloActivos = true }) => {
  const condicion = soloActivos
    ? 'WHERE c.tenant_id = $1 AND c.activo = TRUE'
    : 'WHERE c.tenant_id = $1';

  const { rows } = await query(
    `SELECT c.id, c.nombre, c.precio, c.activo, c.creado_en
     FROM combos c
     ${condicion}
     ORDER BY c.nombre ASC`,
    [tenantId]
  );

  // Cargar productos de cada combo
  for (const combo of rows) {
    const { rows: productos } = await query(
      `SELECT cp.producto_id, cp.cantidad, p.nombre, p.precio
       FROM combo_productos cp
       JOIN productos p ON p.id = cp.producto_id
       WHERE cp.combo_id = $1`,
      [combo.id]
    );
    combo.productos = productos;
  }

  return rows;
};

/**
 * Obtener combo por ID
 */
const obtenerCombo = async ({ tenantId, comboId }) => {
  const { rows } = await query(
    'SELECT id, nombre, precio, activo, creado_en FROM combos WHERE id = $1 AND tenant_id = $2',
    [comboId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Combo no encontrado.' };
  }

  const combo = rows[0];
  const { rows: productos } = await query(
    `SELECT cp.producto_id, cp.cantidad, p.nombre, p.precio
     FROM combo_productos cp
     JOIN productos p ON p.id = cp.producto_id
     WHERE cp.combo_id = $1`,
    [combo.id]
  );
  combo.productos = productos;

  return combo;
};

/**
 * Crear combo con sus productos
 */
const crearCombo = async ({ tenantId, datos }) => {
  const { nombre, precio, productos } = datos;

  // Verificar que los productos existan en el tenant
  for (const p of productos) {
    const { rows } = await query(
      'SELECT id FROM productos WHERE id = $1 AND tenant_id = $2',
      [p.producto_id, tenantId]
    );
    if (rows.length === 0) {
      throw { status: 400, mensaje: `Producto ${p.producto_id} no encontrado en este tenant.` };
    }
  }

  const { rows: comboRows } = await query(
    `INSERT INTO combos (tenant_id, nombre, precio)
     VALUES ($1, $2, $3)
     RETURNING id, nombre, precio, activo, creado_en`,
    [tenantId, nombre, precio]
  );

  const combo = comboRows[0];

  for (const p of productos) {
    await query(
      `INSERT INTO combo_productos (combo_id, producto_id, cantidad)
       VALUES ($1, $2, $3)`,
      [combo.id, p.producto_id, p.cantidad || 1]
    );
  }

  logger.info('Combo creado', { combo_id: combo.id, tenant_id: tenantId, nombre });

  return obtenerCombo({ tenantId, comboId: combo.id });
};

/**
 * Actualizar combo (reemplaza productos si se envía la lista)
 */
const actualizarCombo = async ({ tenantId, comboId, datos }) => {
  await obtenerCombo({ tenantId, comboId });

  const campos = [];
  const valores = [];
  let idx = 1;

  if (datos.nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(datos.nombre); }
  if (datos.precio !== undefined) { campos.push(`precio = $${idx++}`); valores.push(datos.precio); }
  if (datos.activo !== undefined) { campos.push(`activo = $${idx++}`); valores.push(datos.activo); }

  if (campos.length > 0) {
    valores.push(comboId, tenantId);
    await query(
      `UPDATE combos SET ${campos.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx}`,
      valores
    );
  }

  // Si se enviaron productos, reemplazar completamente
  if (datos.productos) {
    await query('DELETE FROM combo_productos WHERE combo_id = $1', [comboId]);

    for (const p of datos.productos) {
      await query(
        `INSERT INTO combo_productos (combo_id, producto_id, cantidad)
         VALUES ($1, $2, $3)`,
        [comboId, p.producto_id, p.cantidad || 1]
      );
    }
  }

  logger.info('Combo actualizado', { combo_id: comboId });

  return obtenerCombo({ tenantId, comboId });
};

/**
 * Desactivar combo (soft delete)
 */
const desactivarCombo = async ({ tenantId, comboId }) => {
  await obtenerCombo({ tenantId, comboId });

  await query(
    'UPDATE combos SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [comboId, tenantId]
  );

  logger.info('Combo desactivado', { combo_id: comboId });
};

module.exports = {
  listarCombos,
  obtenerCombo,
  crearCombo,
  actualizarCombo,
  desactivarCombo,
};
