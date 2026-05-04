// src/middlewares/role.middleware.js
// Middleware de autorización: verifica que el usuario tenga el rol requerido
// Siempre se usa DESPUÉS de autenticar()

const { sinPermiso } = require('../utils/response');

/**
 * requiereRol(...roles)
 * Uso: router.get('/ruta', autenticar, requiereRol('administrador'), controller)
 * Acepta múltiples roles: requiereRol('administrador', 'cajero')
 */
const requiereRol = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return sinPermiso(res, 'No autenticado.');
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return sinPermiso(
        res,
        `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}.`
      );
    }

    next();
  };
};

// Shortcuts para los roles más comunes
const soloAdmin       = requiereRol('administrador');
const adminOCajero    = requiereRol('administrador', 'cajero');
const todosLosRoles   = requiereRol('administrador', 'cajero', 'mesero');

module.exports = {
  requiereRol,
  soloAdmin,
  adminOCajero,
  todosLosRoles,
};
