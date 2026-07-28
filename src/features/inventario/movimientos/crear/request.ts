import Joi from 'joi';

export const crearMovimientoSchema = Joi.object({
  producto_id: Joi.string().uuid().required().messages({
    'string.uuid': 'El ID del producto no es válido.',
    'any.required': 'El producto es requerido.',
  }),
  tipo: Joi.string().valid('compra', 'ajuste', 'merma', 'devolucion').required().messages({
    'any.only': 'El tipo de movimiento debe ser compra, ajuste, merma o devolucion.',
    'any.required': 'El tipo de movimiento es requerido.',
  }),
  cantidad: Joi.number().min(0.0001).required().messages({
    'number.min': 'La cantidad debe ser mayor a 0.',
    'any.required': 'La cantidad es requerida.',
  }),
  unidad_medida_id: Joi.string().uuid().optional().allow(null).messages({
    'string.uuid': 'La unidad de medida no es válida.',
  }),
  motivo: Joi.string().max(255).optional().allow('', null),
});
