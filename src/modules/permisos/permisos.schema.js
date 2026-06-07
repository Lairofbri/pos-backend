// src/modules/permisos/permisos.schema.js
// Esquemas de validación Joi — Módulo Permisos
// Principio S (SOLID): solo valida, no opera ni responde

const Joi = require('joi');

// Roles válidos del sistema
const ROLES_VALIDOS = ['administrador', 'gerente', 'cajero', 'mesero', 'cocinero'];

const rolParamSchema = Joi.object({
  rol: Joi.string()
    .valid(...ROLES_VALIDOS)
    .required()
    .messages({
      'any.only': `El rol debe ser: ${ROLES_VALIDOS.join(', ')}.`,
      'any.required': 'El parámetro rol es requerido.',
    }),
});

const actualizarPermisosSchema = Joi.object({
  permisos: Joi.array()
    .items(
      Joi.object({
        codigo: Joi.string().max(100).required(),
        activo: Joi.boolean().required(),
      })
    )
    .min(1)
    .required()
    .messages({
      'any.required': 'El array de permisos es requerido.',
      'array.min': 'Debe enviar al menos un permiso.',
    }),
});

module.exports = {
  ROLES_VALIDOS,
  rolParamSchema,
  actualizarPermisosSchema,
};
