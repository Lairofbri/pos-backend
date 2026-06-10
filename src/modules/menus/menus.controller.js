// src/modules/menus/menus.controller.js
// Orquesta los requests HTTP del módulo de menús

const service = require('./menus.service');
const { query } = require('../../config/database');
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

/**
 * GET /api/menus
 * Devuelve el árbol de menús filtrado por los permisos del usuario autenticado
 */
const listarMenus = async (req, res) => {
  try {
    let permisosUsuario = null;
    if (req.usuario.rol !== 'administrador') {
      const { rows } = await query(
        `SELECT p.codigo
         FROM rol_permisos rp
         JOIN permisos p ON p.id = rp.permiso_id
         WHERE rp.rol = $1 AND rp.tenant_id = $2 AND rp.activo = TRUE`,
        [req.usuario.rol, req.usuario.tenant_id]
      );
      permisosUsuario = rows.map(r => r.codigo);
    }

    const menus = await service.obtenerMenus({
      tenantId: req.usuario.tenant_id,
      permisosUsuario,
    });

    return exito(res, menus);
  } catch (err) { return manejarError(res, err); }
};

/**
 * GET /api/menus/:id
 */
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

/**
 * POST /api/menus
 */
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

/**
 * PATCH /api/menus/:id
 */
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

/**
 * DELETE /api/menus/:id
 */
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
