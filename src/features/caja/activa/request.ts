import Joi from 'joi';

export const activaQuerySchema = Joi.object({
  sucursal_id: Joi.string().uuid().optional().allow(null),
});
