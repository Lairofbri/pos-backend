const Joi = require('joi');

const crearMenuSchema = Joi.object({
  titulo: Joi.string().min(2).max(100).required().messages({
    'string.min': 'El título debe tener al menos 2 caracteres.',
    'any.required': 'El título del menú es requerido.',
  }),
  icono: Joi.string().max(50).optional().allow('', null),
  ruta: Joi.string().max(200).optional().allow('', null),
  parent_id: Joi.string().uuid().optional().allow(null),
  orden: Joi.number().integer().min(0).optional().default(0),
  permiso_codigo: Joi.string().max(100).optional().allow('', null),
});

const actualizarMenuSchema = Joi.object({
  titulo: Joi.string().min(2).max(100).optional(),
  icono: Joi.string().max(50).optional().allow('', null),
  ruta: Joi.string().max(200).optional().allow('', null),
  parent_id: Joi.string().uuid().optional().allow(null),
  orden: Joi.number().integer().min(0).optional(),
  permiso_codigo: Joi.string().max(100).optional().allow('', null),
  activo: Joi.boolean().optional(),
}).min(1);

module.exports = { crearMenuSchema, actualizarMenuSchema };
