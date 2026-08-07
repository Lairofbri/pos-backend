import Joi from 'joi';

export const rentabilidadSchema = Joi.object({
  orden: Joi.string().valid('margen_desc', 'margen_asc', 'precio_desc', 'precio_asc', 'nombre').optional().default('margen_desc'),
  categoria_id: Joi.string().uuid().optional(),
});

export const evolucionSchema = Joi.object({
  desde: Joi.date().iso().optional(),
  hasta: Joi.date().iso().optional(),
});
