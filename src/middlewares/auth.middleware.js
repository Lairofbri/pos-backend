// src/middlewares/auth.middleware.js
// Middleware que verifica el JWT en cada request protegido
// Inyecta req.usuario con los datos del token decodificado

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { noAutenticado } = require('../utils/response');

/**
 * autenticar — Middleware principal
 * Extrae el token del header Authorization: Bearer <token>
 * Si es válido, inyecta req.usuario y llama next()
 * Si no, responde 401
 */
const autenticar = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return noAutenticado(res);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Inyectar datos del usuario en el request para uso en controllers
    req.usuario = {
      id:          decoded.sub,
      tenant_id:   decoded.tenant_id,
      rol:         decoded.rol,
      nombre:      decoded.nombre,
      sucursal_id: decoded.sucursal_id || null,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return noAutenticado(res, 'Sesión expirada. Por favor inicia sesión nuevamente.');
    }
    return noAutenticado(res, 'Token inválido.');
  }
};

module.exports = { autenticar };
