// src/modules/menus/menus.controller.js
// Orquesta los requests HTTP del módulo de menús

const service = require('./menus.service');
const { query } = require('../../config/database');
const { exito, errorServidor } = require('../../utils/response');
const logger = require('../../utils/logger');

const manejarError = (res, err) => {
  logger.error('Error en menús', { error: err.message });
  return errorServidor(res);
};

/**
 * GET /api/menus
 * Devuelve el árbol de menús filtrado por los permisos del usuario autenticado
 */
const listarMenus = async (req, res) => {
  try {
    // Cargar permisos del usuario para filtrar menús
    let permisosUsuario = null; // null = admin, ve todo
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

module.exports = { listarMenus };
