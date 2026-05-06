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
const { esUuidValido } = require('../../middlewares/uuid.middleware');
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
  logger.error('Error no controlado en POS', { error: err.message, stack: err.stack });
  return errorServidor(res);
};

// ═════════════════════════════════════════════
// MESAS
// ═════════════════════════════════════════════

/**
 * GET /api/mesas
 * Fix CUBIC: solo admin puede ver inactivas
 */
const listarMesas = async (req, res) => {
  try {
    const esAdmin     = req.usuario.rol === 'administrador';
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
 * Fix CUBIC: valida UUID antes de consultar
 */
const obtenerMesa = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de mesa no tiene un formato UUID válido.', 400);
  }

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
 * Fix CUBIC: valida UUID antes de actualizar
 */
const actualizarMesa = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de mesa no tiene un formato UUID válido.', 400);
  }

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
 * Fix CUBIC: Number() + isInteger(), validar UUIDs en query params
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
  if (req.query.usuario_id && !esUuidValido(req.query.usuario_id)) {
    return error(res, 'El parámetro usuario_id no tiene un formato UUID válido.', 400);
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
 * Fix CUBIC: valida UUID antes de consultar
 */
const obtenerOrden = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

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
 * Fix CUBIC: valida UUID antes de actualizar
 */
const actualizarOrden = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

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
 * Fix CUBIC: valida UUID antes de cambiar estado
 */
const cambiarEstadoOrden = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

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
 * Fix CUBIC: valida UUID de orden antes de agregar item
 */
const agregarItem = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

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
 * Fix CUBIC: valida ambos UUIDs antes de actualizar
 */
const actualizarItem = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }
  if (!esUuidValido(req.params.itemId)) {
    return error(res, 'El ID de item no tiene un formato UUID válido.', 400);
  }

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
 * Fix CUBIC: valida ambos UUIDs antes de eliminar
 */
const eliminarItem = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }
  if (!esUuidValido(req.params.itemId)) {
    return error(res, 'El ID de item no tiene un formato UUID válido.', 400);
  }

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
 * Fix CUBIC: valida UUID antes de registrar pago
 */
const registrarPago = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

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
  listarMesas,
  obtenerMesa,
  crearMesa,
  actualizarMesa,
  listarOrdenes,
  obtenerOrden,
  crearOrden,
  actualizarOrden,
  cambiarEstadoOrden,
  agregarItem,
  actualizarItem,
  eliminarItem,
  registrarPago,
};
