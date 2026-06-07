// src/modules/permisos/permisos.controller.js
// Orquesta los requests HTTP del módulo de permisos
// Principio S (SOLID): solo recibe, valida y responde — no opera datos

const service = require('./permisos.service');
const { rolParamSchema, actualizarPermisosSchema } = require('./permisos.schema');
const { exito, error, errorServidor } = require('../../utils/response');
const logger = require('../../utils/logger');

const manejarError = (res, err) => {
  if (err.status && err.mensaje) {
    return error(res, err.mensaje, err.status);
  }
  logger.error('Error no controlado en permisos', { error: err.message, stack: err.stack });
  return errorServidor(res);
};

/**
 * GET /api/permisos
 * Catálogo completo de permisos disponibles
 */
const listarCatalogo = async (_req, res) => {
  try {
    const catalogo = await service.listarCatalogo();
    return exito(res, catalogo);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/permisos/rol/:rol
 * Permisos de un rol con estado activo para el tenant
 */
const obtenerPermisosRol = async (req, res) => {
  const { error: validacionError, value } = rolParamSchema.validate({ rol: req.params.rol });
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const permisos = await service.obtenerPermisosRol({
      tenantId: req.usuario.tenant_id,
      rol: value.rol,
    });
    return exito(res, permisos);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PUT /api/permisos/rol/:rol
 * Activar o desactivar permisos para un rol
 */
const actualizarPermisosRol = async (req, res) => {
  const { error: rolError, value: rolValue } = rolParamSchema.validate({ rol: req.params.rol });
  if (rolError) return error(res, rolError.details[0].message, 400);

  const { error: bodyError, value: bodyValue } = actualizarPermisosSchema.validate(req.body);
  if (bodyError) return error(res, bodyError.details[0].message, 400);

  try {
    const permisos = await service.actualizarPermisosRol({
      tenantId: req.usuario.tenant_id,
      rol: rolValue.rol,
      permisos: bodyValue.permisos,
    });
    return exito(res, permisos, 'Permisos actualizados exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/permisos/roles
 * Lista de roles disponibles en el sistema
 */
const listarRoles = async (_req, res) => {
  try {
    const roles = await service.listarRoles();
    return exito(res, roles);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * POST /api/permisos/rol/:rol/reset
 * Resetear permisos de un rol a valores default
 */
const resetearPermisosRol = async (req, res) => {
  const { error: validacionError, value } = rolParamSchema.validate({ rol: req.params.rol });
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const permisos = await service.resetearPermisosRol({
      tenantId: req.usuario.tenant_id,
      rol: value.rol,
    });
    return exito(res, permisos, 'Permisos reseteados a valores default.');
  } catch (err) {
    return manejarError(res, err);
  }
};

module.exports = {
  listarCatalogo,
  obtenerPermisosRol,
  actualizarPermisosRol,
  listarRoles,
  resetearPermisosRol,
};
