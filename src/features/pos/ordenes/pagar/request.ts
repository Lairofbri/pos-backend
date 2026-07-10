import Joi from 'joi';

export const registrarPagoSchema = Joi.object({
  metodo: Joi.string()
    .valid('efectivo', 'tarjeta', 'mixto')
    .required()
    .messages({
      'any.only': 'El método debe ser efectivo, tarjeta o mixto.',
      'any.required': 'El método de pago es requerido.',
    }),
  monto_efectivo: Joi.when('metodo', {
    is: Joi.valid('efectivo', 'mixto'),
    then: Joi.number().min(0).required().messages({
      'any.required': 'El monto en efectivo es requerido.',
      'number.min': 'El monto en efectivo no puede ser negativo.',
    }),
    otherwise: Joi.number().min(0).optional().default(0),
  }),
  monto_tarjeta: Joi.when('metodo', {
    is: Joi.valid('tarjeta', 'mixto'),
    then: Joi.number().min(0).required().messages({
      'any.required': 'El monto en tarjeta es requerido.',
      'number.min': 'El monto en tarjeta no puede ser negativo.',
    }),
    otherwise: Joi.number().min(0).optional().default(0),
  }),
  referencia_tarjeta: Joi.string().max(50).optional().allow('', null),
});
