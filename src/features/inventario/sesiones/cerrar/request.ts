import Joi from 'joi';

export const cerrarSesionSchema = Joi.object({
  lineas: Joi.array().items(
    Joi.object({
      producto_id: Joi.string().uuid().required(),
      aplicar: Joi.boolean().required(),
    })
  ).required().min(0),
});
