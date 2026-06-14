// src/modules/menus/menus.controller.js
// Orquesta los requests HTTP del módulo de menús

const service = require('./menus.service');
const { exito, creado, error, errorServidor } = require('../../utils/response');
const { esUuidValido } = require('../../middlewares/uuid.middleware');
const { crearMenuSchema, actualizarMenuSchema } = require('./menus.schema');
const logger = require('../../utils/logger');

const manejarError = (res, err) => {
  if (err.status && err.mensaje) {
    return error(res, err.mensaje, err.status);
  }
  logger.error('Error en menús', { error: err.message });
  return errorServidor(res);
};

const listarMenus = async (req, res) => {
  try {
    const menus = await service.obtenerMenus({
      tenantId: req.usuario.tenant_id,
      rol: req.usuario.rol,
      esAdmin: req.usuario.rol === 'administrador',
    });
    return exito(res, { menus });
  } catch (err) { return manejarError(res, err); }
};

const obtenerMenu = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de menú no tiene un formato UUID válido.', 400);
  }

  try {
    const menu = await service.obtenerMenu({
      tenantId: req.usuario.tenant_id,
      menuId: req.params.id,
    });
    return exito(res, { menu });
  } catch (err) { return manejarError(res, err); }
};

const crearMenu = async (req, res) => {
  const { error: validacionError, value } = crearMenuSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const menu = await service.crearMenu({
      tenantId: req.usuario.tenant_id,
      datos: value,
    });
    return creado(res, { menu }, 'Menú creado exitosamente.');
  } catch (err) { return manejarError(res, err); }
};

const actualizarMenu = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de menú no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = actualizarMenuSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const menu = await service.actualizarMenu({
      tenantId: req.usuario.tenant_id,
      menuId: req.params.id,
      datos: value,
    });
    return exito(res, { menu }, 'Menú actualizado exitosamente.');
  } catch (err) { return manejarError(res, err); }
};

const desactivarMenu = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de menú no tiene un formato UUID válido.', 400);
  }

  try {
    await service.desactivarMenu({
      tenantId: req.usuario.tenant_id,
      menuId: req.params.id,
    });
    return exito(res, null, 'Menú desactivado exitosamente.');
  } catch (err) { return manejarError(res, err); }
};

module.exports = { listarMenus, obtenerMenu, crearMenu, actualizarMenu, desactivarMenu };
