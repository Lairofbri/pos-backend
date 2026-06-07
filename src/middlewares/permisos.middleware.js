// src/middlewares/permisos.middleware.js
// Middleware que verifica permisos granulares en cada request
// Reemplaza progresivamente a role.middleware.js
// Principio S (SOLID): solo verifica permisos, no conoce roles

const { query } = require('../config/database');
const { sinPermiso } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * requierePermiso(...codigos)
 * Uso: router.post('/ordenes', autenticar, requierePermiso('ordenes.crear'), controller)
 * Acepta múltiples permisos: requierePermiso('ordenes.ver', 'ordenes.crear')
 * Basta con que el usuario tenga UNO de los permisos listados.
 */
const requierePermiso = (...codigos) => {
  return async (req, res, next) => {
    if (!req.usuario) {
      return sinPermiso(res, 'No autenticado.');
    }

    // Safeguard: administrador siempre tiene todos los permisos
    if (req.usuario.rol === 'administrador') {
      return next();
    }

    try {
      const { rows } = await query(
        `SELECT rp.activo, p.codigo
         FROM rol_permisos rp
         JOIN permisos p ON p.id = rp.permiso_id
         WHERE rp.rol = $1 AND rp.tenant_id = $2 AND rp.activo = TRUE`,
        [req.usuario.rol, req.usuario.tenant_id]
      );

      const permisosActivos = new Set(rows.map(r => r.codigo));

      const tienePermiso = codigos.some(codigo => permisosActivos.has(codigo));

      if (!tienePermiso) {
        return sinPermiso(res, 'No tienes permiso para realizar esta acción.');
      }

      next();
    } catch (err) {
      logger.error('Error verificando permisos', {
        error: err.message,
        usuario_id: req.usuario.id,
        rol: req.usuario.rol,
        tenant_id: req.usuario.tenant_id,
        permisos_requeridos: codigos,
      });
      return sinPermiso(res, 'Error al verificar permisos.');
    }
  };
};

module.exports = { requierePermiso };
