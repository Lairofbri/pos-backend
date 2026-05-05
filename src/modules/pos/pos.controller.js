// src/modules/pos/pos.controller.js
// Orquesta los requests HTTP del módulo POS
// Principio S (SOLID): solo recibe, valida y responde — no opera datos

const service = require('./pos.service');
const {
  crearMesaSchema,
  actualizarMesaSchema,
  crearOrdenSchema,
  actualizarOrdenSchema,
  cambiarEstadoSchema,
  agregarItemSchema,
  actualizarItemSchema,
  registrarPagoSchema,
  filtrosOrdenesSchema,
} = require('./pos.schema');
const {
  exito,
  creado,
  error,
  errorServidor,
} = require('../../utils/response');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────
// Helper: manejo de errores del service
// ─────────────────────────────────────────────
const manejarError = (res, err) => {
  if (err.status && err.mensaje) {
    return error(res, err.mensaje, err.status);
  }
  if (err.code === '23505') {
    return error(res, 'Ya existe un registro con ese valor.', 409);
  }
  logger.error('Error no controlado en POS', {
    error: err.message,
    stack: err.stack,
  });
  return errorServidor(res);
};

// ═════════════════════════════════════════════
// MESAS
// ═════════════════════════════════════════════

/**
 * GET /api/mesas
 * Lista todas las mesas del tenant
 * Query param: ?todas=true para incluir inactivas (solo admin)
 */
const listarMesas = async (req, res) => {
  try {
    const esAdmin    = req.usuario.rol === 'administrador';
    const soloActivas = !esAdmin || req.query.todas !== 'true';

    const mesas = await service.listarMesas({
      tenantId: req.usuario.tenant_id,
      soloActivas,
    });
    return exito(res, mesas);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/mesas/:id
 */
const obtenerMesa = async (req, res) => {
  try {
    const mesa = await service.obtenerMesa({
      tenantId: req.usuario.tenant_id,
      mesaId:   req.params.id,
    });
    return exito(res, mesa);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * POST /api/mesas
 */
const crearMesa = async (req, res) => {
  const { error: validacionError, value } = crearMesaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const mesa = await service.crearMesa({
      tenantId: req.usuario.tenant_id,
      datos:    value,
    });
    return creado(res, mesa, 'Mesa creada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/mesas/:id
 */
const actualizarMesa = async (req, res) => {
  const { error: validacionError, value } = actualizarMesaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const mesa = await service.actualizarMesa({
      tenantId: req.usuario.tenant_id,
      mesaId:   req.params.id,
      datos:    value,
    });
    return exito(res, mesa, 'Mesa actualizada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

// ═════════════════════════════════════════════
// ÓRDENES
// ═════════════════════════════════════════════

/**
 * GET /api/ordenes
 * Lista órdenes con filtros opcionales
 */
const listarOrdenes = async (req, res) => {
  const paginaRaw = req.query.pagina ? Number(req.query.pagina) : 1;
  const limiteRaw = req.query.limite ? Number(req.query.limite) : 50;

  if (req.query.pagina && (!Number.isInteger(paginaRaw) || paginaRaw < 1)) {
    return error(res, 'El parámetro pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limiteRaw) || limiteRaw < 1)) {
    return error(res, 'El parámetro limite debe ser un número entero positivo.', 400);
  }

  const { error: validacionError, value: filtros } = filtrosOrdenesSchema.validate({
    ...req.query,
    pagina: paginaRaw,
    limite: limiteRaw,
  });

  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await service.listarOrdenes({
      tenantId: req.usuario.tenant_id,
      filtros,
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/ordenes/:id
 * Detalle completo de una orden con items y pago
 */
const obtenerOrden = async (req, res) => {
  try {
    const orden = await service.obtenerOrden({
      tenantId: req.usuario.tenant_id,
      ordenId:  req.params.id,
    });
    return exito(res, orden);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * POST /api/ordenes
 * Crea una nueva orden
 */
const crearOrden = async (req, res) => {
  const { error: validacionError, value } = crearOrdenSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const orden = await service.crearOrden({
      tenantId:  req.usuario.tenant_id,
      usuarioId: req.usuario.id,
      datos:     value,
    });
    return creado(res, orden, 'Orden creada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/ordenes/:id
 * Actualiza notas o descuento de una orden
 */
const actualizarOrden = async (req, res) => {
  const { error: validacionError, value } = actualizarOrdenSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const totales = await service.actualizarOrden({
      tenantId: req.usuario.tenant_id,
      ordenId:  req.params.id,
      datos:    value,
    });
    return exito(res, totales, 'Orden actualizada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/ordenes/:id/estado
 * Cambia el estado de una orden siguiendo el flujo definido
 */
const cambiarEstadoOrden = async (req, res) => {
  const { error: validacionError, value } = cambiarEstadoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    await service.cambiarEstadoOrden({
      tenantId: req.usuario.tenant_id,
      ordenId:  req.params.id,
      estado:   value.estado,
      motivo:   value.motivo,
    });
    return exito(res, null, `Orden marcada como "${value.estado}".`);
  } catch (err) {
    return manejarError(res, err);
  }
};

// ═════════════════════════════════════════════
// ITEMS
// ═════════════════════════════════════════════

/**
 * POST /api/ordenes/:id/items
 * Agrega un producto a la orden
 */
const agregarItem = async (req, res) => {
  const { error: validacionError, value } = agregarItemSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await service.agregarItem({
      tenantId: req.usuario.tenant_id,
      ordenId:  req.params.id,
      datos:    value,
    });
    return creado(res, resultado, 'Producto agregado a la orden.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/ordenes/:id/items/:itemId
 * Modifica cantidad, notas o estado de un item
 */
const actualizarItem = async (req, res) => {
  const { error: validacionError, value } = actualizarItemSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const totales = await service.actualizarItem({
      tenantId: req.usuario.tenant_id,
      ordenId:  req.params.id,
      itemId:   req.params.itemId,
      datos:    value,
    });
    return exito(res, totales, 'Item actualizado.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * DELETE /api/ordenes/:id/items/:itemId
 * Cancela un item de la orden (soft delete)
 */
const eliminarItem = async (req, res) => {
  try {
    const totales = await service.eliminarItem({
      tenantId: req.usuario.tenant_id,
      ordenId:  req.params.id,
      itemId:   req.params.itemId,
    });
    return exito(res, totales, 'Item eliminado de la orden.');
  } catch (err) {
    return manejarError(res, err);
  }
};

// ═════════════════════════════════════════════
// PAGOS
// ═════════════════════════════════════════════

/**
 * POST /api/ordenes/:id/pagar
 * Registra el pago de una orden
 */
const registrarPago = async (req, res) => {
  const { error: validacionError, value } = registrarPagoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await service.registrarPago({
      tenantId:  req.usuario.tenant_id,
      ordenId:   req.params.id,
      usuarioId: req.usuario.id,
      datos:     value,
    });
    return exito(res, resultado, 'Pago registrado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

module.exports = {
  // Mesas
  listarMesas,
  obtenerMesa,
  crearMesa,
  actualizarMesa,
  // Órdenes
  listarOrdenes,
  obtenerOrden,
  crearOrden,
  actualizarOrden,
  cambiarEstadoOrden,
  // Items
  agregarItem,
  actualizarItem,
  eliminarItem,
  // Pagos
  registrarPago,
};
