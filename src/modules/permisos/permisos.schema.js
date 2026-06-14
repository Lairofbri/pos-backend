// src/modules/permisos/permisos.schema.js
// Esquemas de validación Joi — Módulo Permisos
// Los roles válidos se obtienen desde la BD vía fn_roles_validos()

const Joi = require('joi');

const ROLES_VALIDOS = ['administrador', 'cajero', 'mesero', 'gerente', 'cocinero'];

const rolParamSchema = Joi.object({
  rol: Joi.string().valid(...ROLES_VALIDOS).required().messages({
    'any.required': 'El parámetro rol es requerido.',
    'any.only': 'El rol debe ser uno de: administrador, cajero, mesero, gerente, cocinero.',
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
  rolParamSchema,
  actualizarPermisosSchema,
};
