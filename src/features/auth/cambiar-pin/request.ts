import Joi from 'joi';

export const cambiarPinSchema = Joi.object({
  pin_actual: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'El PIN actual debe tener exactamente 6 dígitos.',
      'any.required': 'El PIN actual es requerido.',
    }),
  pin_nuevo: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'El PIN nuevo debe tener exactamente 6 dígitos.',
      'any.required': 'El PIN nuevo es requerido.',
    }),
});
