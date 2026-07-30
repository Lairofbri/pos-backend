import Joi from 'joi';

export const consumirRecetaSchema = Joi.object({
  receta_id: Joi.string().uuid().required().messages({
    'string.uuid': 'El ID de la receta no es válido.',
    'any.required': 'El ID de la receta es requerido.',
  }),
  cantidad: Joi.number().min(0.0001).required().messages({
    'number.min': 'La cantidad debe ser mayor a 0.',
    'any.required': 'La cantidad es requerida.',
  }),
  motivo: Joi.string().max(255).optional().allow('', null),
});
