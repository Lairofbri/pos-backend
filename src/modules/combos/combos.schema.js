// src/modules/combos/combos.schema.js
// Esquemas de validación Joi — Módulo Combos

const Joi = require('joi');

const crearComboSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres.',
    'any.required': 'El nombre del combo es requerido.',
  }),
  precio: Joi.number().precision(2).min(0).required().messages({
    'number.min': 'El precio no puede ser negativo.',
    'any.required': 'El precio es requerido.',
  }),
  productos: Joi.array()
    .items(Joi.object({
      producto_id: Joi.string().uuid().required(),
      cantidad: Joi.number().integer().min(1).default(1),
    }))
    .min(1)
    .required()
    .messages({
      'array.min': 'El combo debe tener al menos un producto.',
      'any.required': 'La lista de productos es requerida.',
    }),
});

const actualizarComboSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).optional(),
  precio: Joi.number().precision(2).min(0).optional(),
  activo: Joi.boolean().optional(),
  productos: Joi.array()
    .items(Joi.object({
      producto_id: Joi.string().uuid().required(),
      cantidad: Joi.number().integer().min(1).default(1),
    }))
    .min(1)
    .optional(),
}).min(1);

module.exports = { crearComboSchema, actualizarComboSchema };
