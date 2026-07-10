import Joi from 'joi';

export const loginPinSchema = Joi.object({
  usuario_id: Joi.string().uuid().required().messages({
    'string.uuid': 'ID de usuario inválido.',
    'any.required': 'El ID de usuario es requerido.',
  }),
  pin: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'El PIN debe tener exactamente 6 dígitos numéricos.',
      'any.required': 'El PIN es requerido.',
    }),
});
