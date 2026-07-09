import Joi from 'joi';

export const loginEmailSchema = Joi.object({
  tenant_id: Joi.string().uuid().required().messages({
    'string.uuid': 'El ID de empresa no es válido.',
    'any.required': 'El ID de empresa es requerido.',
  }),
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  password: Joi.string().min(8).required().messages({
    'string.min': 'La contraseña debe tener al menos 8 caracteres.',
    'any.required': 'La contraseña es requerida.',
  }),
});
