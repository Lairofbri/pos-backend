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
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────
// Helper: manejo de errores del service
// ─────────────────────────────────────────────
const manejarError = (res, err) => {
  if (err.status && err.mensaje) {
    return error(res, err.mensaje, err.status);
  }
  logger.error('Error no controlado en caja', {
    error: err.message,
    stack: err.stack,
  });
  return errorServidor(res);
};

// ─────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────

/**
 * POST /api/caja/abrir
 * Abre un nuevo turno de caja
 * Solo admin y cajero pueden abrir caja
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
 * Obtiene la caja actualmente abierta con resumen del turno
 * Todos los roles pueden consultarla
 */
const getCajaActiva = async (req, res) => {
  try {
    const caja = await service.getCajaActiva({
      tenantId:   req.usuario.tenant_id,
      sucursalId: req.query.sucursal_id || null,
    });
    return exito(res, caja);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * POST /api/caja/cerrar
 * Cierra el turno activo con el monto contado
 * Solo admin y cajero pueden cerrar caja
 */
const cerrarCaja = async (req, res) => {
  const { error: validacionError, value } = cerrarCajaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

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
 * Registra un retiro o depósito manual en la caja activa
 */
const registrarMovimiento = async (req, res) => {
  const { error: validacionError, value } = movimientoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

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
 * Historial de movimientos de una caja específica
 */
const getMovimientos = async (req, res) => {
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
 * Lista el historial de cajas con filtros
 * Solo admin
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
