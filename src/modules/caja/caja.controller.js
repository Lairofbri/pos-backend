// src/modules/caja/caja.controller.js
// Orquesta los requests HTTP del módulo de caja
// Principio S (SOLID): solo recibe, valida y responde — no opera datos

const service = require('./caja.service');
const {
  abrirCajaSchema,
  cerrarCajaSchema,
  movimientoSchema,
  filtrosCajaSchema,
} = require('./caja.schema');
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
  logger.error('Error no controlado en caja', { error: err.message, stack: err.stack });
  return errorServidor(res);
};

// ─────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────

/**
 * POST /api/caja/abrir
 */
const abrirCaja = async (req, res) => {
  const { error: validacionError, value } = abrirCajaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const caja = await service.abrirCaja({
      tenantId:  req.usuario.tenant_id,
      usuarioId: req.usuario.id,
      datos:     value,
    });
    return creado(res, caja, 'Caja abierta exitosamente. Buen turno.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/caja/activa
 * Fix CUBIC: valida formato UUID del sucursal_id en query param
 */
const getCajaActiva = async (req, res) => {
  const { sucursal_id } = req.query;

  // Fix CUBIC error 3: validar UUID del query param antes de pasarlo al service
  if (sucursal_id && !esUuidValido(sucursal_id)) {
    return error(res, 'El parámetro sucursal_id no tiene un formato UUID válido.', 400);
  }

  try {
    const caja = await service.getCajaActiva({
      tenantId:   req.usuario.tenant_id,
      sucursalId: sucursal_id || null,
    });
    return exito(res, caja);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * POST /api/caja/cerrar
 * Fix CUBIC error 2: pasa sucursal_id para evitar cerrar caja equivocada en multi-sucursal
 */
const cerrarCaja = async (req, res) => {
  const { error: validacionError, value } = cerrarCajaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  // Validar sucursal_id si viene en el body
  if (value.sucursal_id && !esUuidValido(value.sucursal_id)) {
    return error(res, 'El campo sucursal_id no tiene un formato UUID válido.', 400);
  }

  try {
    const caja = await service.cerrarCaja({
      tenantId:  req.usuario.tenant_id,
      usuarioId: req.usuario.id,
      datos:     value,
    });
    return exito(res, caja, 'Caja cerrada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * POST /api/caja/movimiento
 * Fix CUBIC error 2: pasa sucursal_id para operar en la caja correcta en multi-sucursal
 */
const registrarMovimiento = async (req, res) => {
  const { error: validacionError, value } = movimientoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  // Validar sucursal_id si viene en el body
  if (value.sucursal_id && !esUuidValido(value.sucursal_id)) {
    return error(res, 'El campo sucursal_id no tiene un formato UUID válido.', 400);
  }

  try {
    const movimiento = await service.registrarMovimiento({
      tenantId:  req.usuario.tenant_id,
      usuarioId: req.usuario.id,
      datos:     value,
    });
    const msg = value.tipo === 'retiro'
      ? `Retiro de $${value.monto} registrado.`
      : `Depósito de $${value.monto} registrado.`;
    return creado(res, movimiento, msg);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/caja/:id/movimientos
 * Fix CUBIC error 4: valida UUID del parámetro :id antes de consultar
 */
const getMovimientos = async (req, res) => {
  // Fix CUBIC: validar UUID antes de que llegue a PostgreSQL
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de caja no tiene un formato UUID válido.', 400);
  }

  const paginaRaw = req.query.pagina ? Number(req.query.pagina) : 1;
  const limiteRaw = req.query.limite ? Number(req.query.limite) : 50;

  if (req.query.pagina && (!Number.isInteger(paginaRaw) || paginaRaw < 1)) {
    return error(res, 'El parámetro pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limiteRaw) || limiteRaw < 1)) {
    return error(res, 'El parámetro limite debe ser un número entero positivo.', 400);
  }

  try {
    const resultado = await service.getMovimientos({
      tenantId: req.usuario.tenant_id,
      cajaId:   req.params.id,
      pagina:   paginaRaw,
      limite:   limiteRaw,
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/caja/historial
 * Fix CUBIC: Number() + isInteger() en paginación
 */
const getHistorialCajas = async (req, res) => {
  const paginaRaw = req.query.pagina ? Number(req.query.pagina) : 1;
  const limiteRaw = req.query.limite ? Number(req.query.limite) : 20;

  if (req.query.pagina && (!Number.isInteger(paginaRaw) || paginaRaw < 1)) {
    return error(res, 'El parámetro pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limiteRaw) || limiteRaw < 1)) {
    return error(res, 'El parámetro limite debe ser un número entero positivo.', 400);
  }

  const { error: validacionError, value: filtros } = filtrosCajaSchema.validate({
    ...req.query,
    pagina: paginaRaw,
    limite: limiteRaw,
  });

  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await service.getHistorialCajas({
      tenantId: req.usuario.tenant_id,
      filtros,
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};

module.exports = {
  abrirCaja,
  getCajaActiva,
  cerrarCaja,
  registrarMovimiento,
  getMovimientos,
  getHistorialCajas,
};
