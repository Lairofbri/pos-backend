import Joi from 'joi';

const ROLES_VALIDOS = ['administrador', 'cajero', 'mesero', 'gerente', 'cocinero'];

export const rolParamSchema = Joi.object({
  rol: Joi.string().valid(...ROLES_VALIDOS).required().messages({
    'any.required': 'El parámetro rol es requerido.',
    'any.only': 'El rol debe ser uno de: administrador, cajero, mesero, gerente, cocinero.',
  }),
});
