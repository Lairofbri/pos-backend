import Joi from 'joi';

export const crearProductoSchema = Joi.object({
  nombre: Joi.string().min(2).max(150).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres.',
    'any.required': 'El nombre del producto es requerido.',
  }),
  descripcion: Joi.string().max(500).optional().allow('', null),
  precio: Joi.number().precision(2).min(0).required().messages({
    'number.min': 'El precio no puede ser negativo.',
    'any.required': 'El precio es requerido.',
  }),
  categoria_id: Joi.string().uuid().optional().allow(null).messages({
    'string.uuid': 'El ID de categoría no es válido.',
  }),
  imagen_url: Joi.string().uri({ allowRelative: true }).max(1024).optional().allow('', null).messages({
    'string.uri': 'La imagen debe ser una URL válida.',
  }),
  tiene_stock: Joi.boolean().optional().default(false),
  stock_actual: Joi.number().integer().min(0).optional().default(0),
  stock_minimo: Joi.number().integer().min(0).optional().default(0),
  codigo: Joi.string().max(50).optional().allow('', null),
  orden: Joi.number().integer().min(0).optional().default(0),
});
