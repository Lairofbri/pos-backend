import Joi from 'joi';

export const actualizarCategoriaSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).optional(),
  descripcion: Joi.string().max(255).optional().allow('', null),
  parent_id: Joi.string().uuid().optional().allow(null),
  orden: Joi.number().integer().min(0).optional(),
  icono: Joi.string().max(10).optional().allow('', null),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional().allow('', null),
  activo: Joi.boolean().optional(),
}).min(1);
