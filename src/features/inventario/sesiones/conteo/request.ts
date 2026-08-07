import Joi from 'joi';

export const registrarConteoSchema = Joi.object({
  producto_id: Joi.string().uuid().required().messages({
    'string.uuid': 'El ID del producto no es válido.',
    'any.required': 'El producto es requerido.',
  }),
  stock_fisico: Joi.number().min(0).required().messages({
    'number.min': 'El stock físico debe ser mayor o igual a 0.',
    'any.required': 'El stock físico es requerido.',
  }),
  unidad_medida_id: Joi.string().uuid().optional().allow(null).messages({
    'string.uuid': 'La unidad de medida no es válida.',
  }),
});
