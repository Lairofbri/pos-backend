import Joi from 'joi';

export const crearUnidadSchema = Joi.object({
  nombre: Joi.string().min(1).max(50).required().messages({
    'any.required': 'El nombre es requerido.',
  }),
  abreviatura: Joi.string().min(1).max(10).required().messages({
    'any.required': 'La abreviatura es requerida.',
  }),
  categoria: Joi.string().valid('masa', 'volumen', 'unidad', 'cocina').required().messages({
    'any.only': 'La categoría debe ser masa, volumen, unidad o cocina.',
    'any.required': 'La categoría es requerida.',
  }),
  factor: Joi.number().min(0.0001).required().messages({
    'any.required': 'El factor de conversión es requerido.',
  }),
});
