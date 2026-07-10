import Joi from 'joi';

export const movimientosQuerySchema = Joi.object({
  pagina: Joi.number().integer().min(1).optional().default(1),
  limite: Joi.number().integer().min(1).max(100).optional().default(50),
});
