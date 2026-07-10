import Joi from 'joi';

export const actualizarUsuarioSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).optional(),
  apellido: Joi.string().min(2).max(100).optional().allow(''),
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().optional().allow('', null),
  rol: Joi.string().valid('administrador', 'cajero', 'mesero').optional(),
  sucursal_id: Joi.string().uuid().optional().allow(null),
  activo: Joi.boolean().optional(),
}).min(1);
