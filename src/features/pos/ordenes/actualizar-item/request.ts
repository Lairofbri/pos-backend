import Joi from 'joi';

export const actualizarItemSchema = Joi.object({
  cantidad: Joi.number().integer().min(1).optional().messages({
    'number.min': 'La cantidad debe ser al menos 1.',
  }),
  notas: Joi.string().max(255).optional().allow('', null),
  estado: Joi.string()
    .valid('pendiente', 'en_proceso', 'listo', 'cancelado')
    .optional()
    .messages({
      'any.only': 'Estado de item inválido.',
    }),
  descuento_porcentaje: Joi.number().min(0).max(100).optional(),
  modificaciones: Joi.object({
    sin: Joi.array().items(Joi.string().uuid()).optional(),
    extra: Joi.array().items(Joi.object({
      producto_id: Joi.string().uuid().required(),
      cantidad: Joi.number().integer().min(1).default(1),
      precio: Joi.number().min(0).required(),
    })).optional(),
    notas_extra: Joi.string().max(255).optional().allow('', null),
  }).optional(),
}).min(1);
