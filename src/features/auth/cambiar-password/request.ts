import Joi from 'joi';

export const cambiarPasswordSchema = Joi.object({
  password_actual: Joi.string().min(8).required(),
  password_nuevo: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
    .required()
    .messages({
      'string.pattern.base':
        'El password nuevo debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.',
    }),
});
