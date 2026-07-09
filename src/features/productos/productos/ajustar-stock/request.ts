import Joi from 'joi';

export const ajustarStockSchema = Joi.object({
  cantidad: Joi.number().integer().required().messages({
    'any.required': 'La cantidad es requerida.',
  }),
  tipo: Joi.string()
    .valid('suma', 'resta', 'absoluto')
    .required()
    .messages({
      'any.only': 'El tipo debe ser suma, resta o absoluto.',
    }),
  motivo: Joi.string().max(255).optional().allow('', null),
});
