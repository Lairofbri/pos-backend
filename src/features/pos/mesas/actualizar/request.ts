import Joi from 'joi';

export const actualizarMesaSchema = Joi.object({
  numero: Joi.string().max(10).optional(),
  nombre: Joi.string().max(50).optional().allow('', null),
  capacidad: Joi.number().integer().min(1).optional(),
  zona: Joi.string().max(50).optional().allow('', null),
  activo: Joi.boolean().optional(),
  estado: Joi.string().optional(),
}).min(1);
