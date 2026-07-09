import Joi from 'joi';

export const actualizarProductoSchema = Joi.object({
  nombre: Joi.string().min(2).max(150).optional(),
  descripcion: Joi.string().max(500).optional().allow('', null),
  precio: Joi.number().precision(2).min(0).optional(),
  categoria_id: Joi.string().uuid().optional().allow(null),
  imagen_url: Joi.string().uri({ allowRelative: true }).max(1024).optional().allow('', null),
  tiene_stock: Joi.boolean().optional(),
  stock_actual: Joi.number().integer().min(0).optional(),
  stock_minimo: Joi.number().integer().min(0).optional(),
  codigo: Joi.string().max(50).optional().allow('', null),
  orden: Joi.number().integer().min(0).optional(),
  activo: Joi.boolean().optional(),
}).min(1);
