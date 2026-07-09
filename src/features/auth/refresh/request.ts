import Joi from 'joi';

export const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required().messages({
    'any.required': 'El refresh token es requerido.',
  }),
});
