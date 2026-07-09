import Joi from 'joi';

export const filtrosProductosSchema = Joi.object({
  categoria_id: Joi.string().uuid().optional(),
  activo: Joi.boolean().optional(),
  busqueda: Joi.string().max(100).optional().allow(''),
  con_stock: Joi.boolean().optional(),
  pagina: Joi.number().integer().min(1).optional().default(1),
  limite: Joi.number().integer().min(1).max(100).optional().default(50),
});
