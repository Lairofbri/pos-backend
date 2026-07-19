import Joi from 'joi';

export const loginPinSchema = Joi.object({
  usuario_id: Joi.string().uuid().optional().messages({
    'string.uuid': 'ID de usuario inválido.',
  }),
  pin: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'El PIN debe tener exactamente 6 dígitos numéricos.',
      'any.required': 'El PIN es requerido.',
    }),
});
