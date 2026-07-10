import Joi from 'joi';

export const agregarItemSchema = Joi.object({
  producto_id: Joi.string().uuid().required().messages({
    'any.required': 'El ID de producto es requerido.',
    'string.uuid': 'El ID de producto no es válido.',
  }),
  cantidad: Joi.number().integer().min(1).required().messages({
    'number.min': 'La cantidad debe ser al menos 1.',
    'any.required': 'La cantidad es requerida.',
  }),
  notas: Joi.string().max(255).optional().allow('', null),
  descuento_porcentaje: Joi.number().min(0).max(100).optional().default(0),
});
