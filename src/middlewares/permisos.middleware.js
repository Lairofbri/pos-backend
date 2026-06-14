// src/middlewares/permisos.middleware.js
// Middleware que verifica permisos granulares en cada request
// Delega la verificación a fn_tiene_permiso() en PostgreSQL

const { query } = require('../config/database');
const { sinPermiso } = require('../utils/response');
const logger = require('../utils/logger');

const requierePermiso = (...codigos) => {
  return async (req, res, next) => {
    if (!req.usuario) {
      return sinPermiso(res, 'No autenticado.');
    }

    if (req.usuario.rol === 'administrador') {
      return next();
    }

    try {
      for (const codigo of codigos) {
        const { rows } = await query(
          'SELECT fn_tiene_permiso($1, $2, $3) AS tiene',
          [req.usuario.rol, codigo, req.usuario.tenant_id]
        );
        if (rows[0]?.tiene) {
          return next();
        }
      }

      return sinPermiso(res, 'No tienes permiso para realizar esta acción.');
    } catch (err) {
      logger.error('Error verificando permisos', {
        error: err.message,
        usuario_id: req.usuario.id,
        rol: req.usuario.rol,
        permisos_requeridos: codigos,
      });
      return sinPermiso(res, 'Error al verificar permisos.');
    }
  };
};

module.exports = { requierePermiso };
