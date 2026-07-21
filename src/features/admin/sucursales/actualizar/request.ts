import Joi from 'joi';

export const actualizarSucursalSchema = Joi.object({
  nombre: Joi.string().max(100).optional(),
  direccion: Joi.string().max(255).optional().allow('', null),
  telefono: Joi.string().max(20).optional().allow('', null),
  es_principal: Joi.boolean().optional(),
  activo: Joi.boolean().optional(),
}).min(1).messages({ 'object.min': 'Debe enviar al menos un campo para actualizar.' });
