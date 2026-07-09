import Joi from 'joi';

export const splitOrdenSchema = Joi.object({
  items: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .required()
    .messages({
      'array.min': 'Debe seleccionar al menos un item.',
      'any.required': 'La lista de items es requerida.',
    }),
  tipo: Joi.string()
    .valid('rapido', 'mesa', 'delivery')
    .optional()
    .default('rapido'),
  mesa_id: Joi.string().uuid().optional().allow(null),
  notas: Joi.string().max(255).optional().allow('', null),
});
