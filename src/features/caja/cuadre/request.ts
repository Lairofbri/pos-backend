import Joi from 'joi';

export const cuadreSchema = Joi.object({
  caja_id: Joi.string().uuid().required().messages({
    'string.uuid':  'El ID de caja no tiene un formato UUID válido.',
    'any.required': 'El ID de caja es requerido.',
  }),
});
