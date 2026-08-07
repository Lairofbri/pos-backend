import Joi from 'joi';

const ingredienteSchema = Joi.object({
  ingrediente_id: Joi.string().uuid().required(),
  cantidad: Joi.number().min(0.0001).required(),
  unidad_medida_id: Joi.string().uuid().required(),
  preparacion: Joi.string().max(100).optional().allow('', null),
});

export const actualizarRecetaSchema = Joi.object({
  producto: Joi.object({
    nombre: Joi.string().min(2).max(150),
    precio: Joi.number().precision(2).min(0),
    categoria_id: Joi.string().uuid().optional().allow(null),
    imagen_url: Joi.string().uri({ allowRelative: true }).max(1024).optional().allow('', null),
  }).optional(),
  rendimiento: Joi.number().min(0.01).optional(),
  instrucciones: Joi.string().optional().allow('', null),
  ingredientes: Joi.array().items(ingredienteSchema).min(1).optional(),
});
