import Joi from 'joi';

const ingredienteSchema = Joi.object({
  ingrediente_id: Joi.string().uuid().required().messages({
    'string.uuid': 'El ID del ingrediente no es válido.',
    'any.required': 'El ingrediente es requerido.',
  }),
  cantidad: Joi.number().min(0.0001).required().messages({
    'number.min': 'La cantidad debe ser mayor a 0.',
    'any.required': 'La cantidad del ingrediente es requerida.',
  }),
  unidad_medida_id: Joi.string().uuid().required().messages({
    'string.uuid': 'La unidad de medida no es válida.',
    'any.required': 'La unidad de medida es requerida.',
  }),
  preparacion: Joi.string().max(100).optional().allow('', null),
});

export const crearRecetaSchema = Joi.object({
  producto: Joi.object({
    nombre: Joi.string().min(2).max(150).required().messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres.',
      'any.required': 'El nombre del producto es requerido.',
    }),
    precio: Joi.number().precision(2).min(0).required().messages({
      'number.min': 'El precio no puede ser negativo.',
      'any.required': 'El precio es requerido.',
    }),
    categoria_id: Joi.string().uuid().optional().allow(null).messages({
      'string.uuid': 'El ID de categoría no es válido.',
    }),
    imagen_url: Joi.string().uri({ allowRelative: true }).max(1024).optional().allow('', null),
  }).required(),
  rendimiento: Joi.number().min(0.01).required().messages({
    'number.min': 'El rendimiento debe ser mayor a 0.',
    'any.required': 'El rendimiento es requerido.',
  }),
  instrucciones: Joi.string().optional().allow('', null),
  ingredientes: Joi.array().items(ingredienteSchema).min(1).required().messages({
    'array.min': 'La receta debe tener al menos un ingrediente.',
    'any.required': 'Los ingredientes son requeridos.',
  }),
});
