import Joi from 'joi';

export const crearSucursalSchema = Joi.object({
  nombre: Joi.string().max(100).required().messages({
    'any.required': 'El nombre de la sucursal es requerido.',
    'string.max': 'El nombre no puede exceder los 100 caracteres.',
  }),
  direccion: Joi.string().max(255).optional().allow('', null),
  telefono: Joi.string().max(20).optional().allow('', null),
  es_principal: Joi.boolean().optional().default(false),
});
