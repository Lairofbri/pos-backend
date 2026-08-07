import Joi from 'joi';

export const crearSesionSchema = Joi.object({
  sucursal_id: Joi.string().uuid().optional().allow(null),
  notas: Joi.string().max(500).optional().allow('', null),
});
