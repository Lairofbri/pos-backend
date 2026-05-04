// src/utils/response.js
// Helpers para respuestas HTTP con formato consistente en toda la API
// Todos los endpoints deben usar estas funciones para responder

/**
 * Respuesta exitosa
 * @param {object} res - Express response object
 * @param {*} data - Datos a retornar
 * @param {string} mensaje - Mensaje descriptivo opcional
 * @param {number} status - Código HTTP (default: 200)
 */
const exito = (res, data = null, mensaje = 'OK', status = 200) => {
  return res.status(status).json({
    ok: true,
    mensaje,
    data,
  });
};

/**
 * Respuesta de creación exitosa (201)
 */
const creado = (res, data = null, mensaje = 'Recurso creado exitosamente') => {
  return exito(res, data, mensaje, 201);
};

/**
 * Respuesta de error del cliente (4xx)
 * @param {object} res - Express response object
 * @param {string} mensaje - Mensaje de error
 * @param {number} status - Código HTTP (default: 400)
 * @param {*} errores - Detalles adicionales de validación (opcional)
 */
const error = (res, mensaje = 'Error en la solicitud', status = 400, errores = null) => {
  const cuerpo = { ok: false, mensaje };
  if (errores) cuerpo.errores = errores;
  return res.status(status).json(cuerpo);
};

/**
 * Error de autenticación (401)
 */
const noAutenticado = (res, mensaje = 'No autenticado. Inicia sesión para continuar.') => {
  return error(res, mensaje, 401);
};

/**
 * Error de autorización (403)
 */
const sinPermiso = (res, mensaje = 'No tienes permiso para realizar esta acción.') => {
  return error(res, mensaje, 403);
};

/**
 * Recurso no encontrado (404)
 */
const noEncontrado = (res, mensaje = 'Recurso no encontrado.') => {
  return error(res, mensaje, 404);
};

/**
 * Error interno del servidor (500)
 * En producción no expone detalles técnicos al cliente
 */
const errorServidor = (res, mensaje = 'Error interno del servidor.') => {
  return error(res, mensaje, 500);
};

module.exports = {
  exito,
  creado,
  error,
  noAutenticado,
  sinPermiso,
  noEncontrado,
  errorServidor,
};
