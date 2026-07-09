import Joi from 'joi';

export const crearUsuarioSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required(),
  apellido: Joi.string().min(2).max(100).optional().allow(''),
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().optional().allow('', null),
  pin: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'El PIN debe tener exactamente 6 dígitos numéricos.',
    }),
  password: Joi.string().min(8).pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])/).optional().allow('', null).messages({
    'string.min': 'El password debe tener al menos 8 caracteres.',
    'string.pattern.base': 'El password debe contener mayúscula, minúscula, número y carácter especial.',
  }),
  rol: Joi.string()
    .valid('administrador', 'cajero', 'mesero')
    .required()
    .messages({
      'any.only': 'El rol debe ser administrador, cajero o mesero.',
    }),
  sucursal_id: Joi.string().uuid().optional().allow(null),
});
