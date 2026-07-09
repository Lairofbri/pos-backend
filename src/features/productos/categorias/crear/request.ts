import Joi from 'joi';

export const crearCategoriaSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres.',
    'any.required': 'El nombre de la categoría es requerido.',
  }),
  descripcion: Joi.string().max(255).optional().allow('', null),
  parent_id: Joi.string().uuid().optional().allow(null).messages({
    'string.uuid': 'El ID de categoría padre no es válido.',
  }),
  orden: Joi.number().integer().min(0).optional().default(0),
  icono: Joi.string().max(10).optional().allow('', null).messages({
    'string.max': 'El icono no debe exceder 10 caracteres.',
  }),
  color: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .allow('', null)
    .messages({
      'string.pattern.base': 'El color debe ser un valor hexadecimal válido. Ej: #FF5733',
    }),
});
