import Joi from 'joi';

export const listarCuentasSchema = Joi.object({
  fecha_desde: Joi.date().iso().optional(),
  fecha_hasta: Joi.date().iso().optional(),
  tipo: Joi.string().valid('rapido', 'mesa', 'delivery').optional(),
  pagina: Joi.number().integer().min(1).optional().default(1),
  limite: Joi.number().integer().min(1).max(100).optional().default(50),
});

export const exportarCuentasSchema = Joi.object({
  fecha_desde: Joi.date().iso().optional(),
  fecha_hasta: Joi.date().iso().optional(),
  tipo: Joi.string().valid('rapido', 'mesa', 'delivery').optional(),
});
