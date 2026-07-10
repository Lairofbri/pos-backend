import Joi from 'joi';

export const filtrosCajaSchema = Joi.object({
  estado:      Joi.string().valid('abierta', 'cerrada').optional(),
  fecha_desde: Joi.date().iso().optional(),
  fecha_hasta: Joi.date().iso().optional(),
  sucursal_id: Joi.string().uuid().optional().allow(null),
  pagina:      Joi.number().integer().min(1).optional().default(1),
  limite:      Joi.number().integer().min(1).max(100).optional().default(20),
});
