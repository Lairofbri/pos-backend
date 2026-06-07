// src/middlewares/uuid.middleware.js
// Middleware y helper para validar UUIDs en params y query params
// Principio S (SOLID): responsabilidad única — solo valida formato UUID
// Principio D (SOLID): los controllers dependen de esta abstracción

const { error } = require('../utils/response');

// Regex UUID v4 estándar
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida si un string es un UUID v4 válido
 * @param {string} valor
 * @returns {boolean}
 */
const esUuidValido = (valor) => {
  if (!valor || typeof valor !== 'string') return false;
  return UUID_REGEX.test(valor);
};

/**
 * Middleware factory — valida que req.params[param] sea un UUID válido
 * Uso: router.get('/:id', validarUuidParam('id'), controller.obtener)
 * @param {string} param — nombre del parámetro en req.params
 * @param {string} nombreLegible — nombre para el mensaje de error
 */
const validarUuidParam = (param = 'id', nombreLegible = null) => {
  return (req, res, next) => {
    const valor = req.params[param];
    const nombre = nombreLegible || param;

    if (!esUuidValido(valor)) {
      return error(res, `El parámetro ${nombre} no tiene un formato UUID válido.`, 400);
    }
    next();
  };
};

/**
 * Valida UUIDs en query params — uso directo en controllers
 * Retorna el error HTTP si es inválido, null si es válido o no existe
 * @param {object} res — Express response
 * @param {string} valor — valor del query param
 * @param {string} nombre — nombre del param para el mensaje
 */
const validarUuidQuery = (res, valor, nombre) => {
  if (valor != null && !esUuidValido(valor)) {
    error(res, `El parámetro ${nombre} no tiene un formato UUID válido.`, 400);
    return false;
  }
  return true;
};

module.exports = {
  esUuidValido,
  validarUuidParam,
  validarUuidQuery,
};
