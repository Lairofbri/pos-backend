import Joi from 'joi';

export const cambiarMesaSchema = Joi.object({
  mesa_id: Joi.string().uuid().required().messages({
    'any.required': 'El ID de la mesa destino es requerido.',
    'string.uuid': 'El ID de mesa no es válido.',
  }),
});
