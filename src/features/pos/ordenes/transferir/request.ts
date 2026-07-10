import Joi from 'joi';

export const transferirItemsSchema = Joi.object({
  items: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .required()
    .messages({
      'array.min': 'Debe seleccionar al menos un item.',
      'any.required': 'La lista de items es requerida.',
    }),
  orden_destino_id: Joi.string().uuid().required().messages({
    'any.required': 'El ID de la orden destino es requerido.',
    'string.uuid': 'El ID de la orden destino no es válido.',
  }),
});
