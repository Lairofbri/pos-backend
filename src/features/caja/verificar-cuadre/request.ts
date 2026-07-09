import Joi from 'joi';

export const verificarCuadreSchema = Joi.object({
  monto_final: Joi.number().min(0).required().messages({
    'number.min':   'El monto final no puede ser negativo.',
    'any.required': 'El monto contado es requerido para verificar el cuadre.',
  }),
  sucursal_id: Joi.string().uuid().optional().allow(null).messages({
    'string.uuid': 'El sucursal_id no tiene un formato UUID válido.',
  }),
});
