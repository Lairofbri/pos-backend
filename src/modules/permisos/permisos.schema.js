// src/modules/permisos/permisos.schema.js
// Esquemas de validación Joi — Módulo Permisos
// Los roles válidos se obtienen desde la BD vía fn_roles_validos()

const Joi = require('joi');

const rolParamSchema = Joi.object({
  rol: Joi.string().required().messages({
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
  rolParamSchema,
  actualizarPermisosSchema,
};
