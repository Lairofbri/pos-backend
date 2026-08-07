import Joi from 'joi';

export const kardexSchema = Joi.object({
  desde: Joi.date().iso().optional(),
  hasta: Joi.date().iso().optional(),
  pagina: Joi.number().integer().min(1).optional().default(1),
  limite: Joi.number().integer().min(1).max(100).optional().default(50),
});
