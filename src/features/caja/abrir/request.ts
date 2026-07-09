import Joi from 'joi';

export const abrirCajaSchema = Joi.object({
  monto_inicial: Joi.number().min(0).required().messages({
    'number.min':   'El monto inicial no puede ser negativo.',
    'any.required': 'El monto inicial es requerido.',
  }),
  sucursal_id: Joi.string().uuid().optional().allow(null).messages({
    'string.uuid': 'El sucursal_id no tiene un formato UUID válido.',
  }),
  notas: Joi.string().max(500).optional().allow('', null),
});
