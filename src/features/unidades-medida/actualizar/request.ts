import Joi from 'joi';

export const actualizarUnidadSchema = Joi.object({
  nombre: Joi.string().min(1).max(50).optional(),
  abreviatura: Joi.string().min(1).max(10).optional(),
  categoria: Joi.string().valid('masa', 'volumen', 'unidad').optional(),
  factor: Joi.number().min(0.0001).optional(),
}).min(1);
