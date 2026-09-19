import Joi from 'joi';

export const actualizarRestauranteSchema = Joi.object({
  nombre: Joi.string().max(100).optional(),
  nit: Joi.string().max(20).optional().allow('', null),
  nrc: Joi.string().max(20).optional().allow('', null),
  direccion: Joi.string().max(255).optional().allow('', null),
  telefono: Joi.string().max(20).optional().allow('', null),
  email: Joi.string().email().max(100).optional().allow('', null),
  logo_url: Joi.string().uri().max(500).optional().allow('', null),
  pos_default_mode: Joi.string().valid('mesas', 'rapido').optional(),
}).min(1).messages({ 'object.min': 'Debe enviar al menos un campo para actualizar.' });
