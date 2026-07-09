import Joi from 'joi';

export const actualizarPropinaSchema = Joi.object({
  porcentaje: Joi.number().min(0).max(100).precision(2).required().messages({
    'number.min': 'El porcentaje de propina no puede ser negativo.',
    'number.max': 'El porcentaje de propina no puede superar el 100%.',
    'any.required': 'El porcentaje de propina es requerido.',
  }),
  monto: Joi.number().min(0).precision(2).optional().default(0).messages({
    'number.min': 'El monto de propina no puede ser negativo.',
  }),
});
