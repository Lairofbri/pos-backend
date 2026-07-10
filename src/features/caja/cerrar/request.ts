import Joi from 'joi';

export const cerrarCajaSchema = Joi.object({
  monto_final: Joi.number().min(0).required().messages({
    'number.min':   'El monto final no puede ser negativo.',
    'any.required': 'El monto contado es requerido para cerrar la caja.',
  }),
  notas_cierre: Joi.string().max(500).optional().allow('', null),
  sucursal_id:  Joi.string().uuid().optional().allow(null).messages({
    'string.uuid': 'El sucursal_id no tiene un formato UUID válido.',
  }),
});
