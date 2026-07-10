import Joi from 'joi';

export const crearOrdenSchema = Joi.object({
  tipo: Joi.string()
    .valid('rapido', 'mesa', 'delivery')
    .required()
    .messages({
      'any.only': 'El tipo debe ser rapido, mesa o delivery.',
      'any.required': 'El tipo de orden es requerido.',
    }),
  mesa_id: Joi.when('tipo', {
    is: 'mesa',
    then: Joi.string().uuid().required().messages({
      'any.required': 'El ID de mesa es requerido para órdenes de tipo mesa.',
      'string.uuid': 'El ID de mesa no es válido.',
    }),
    otherwise: Joi.string().uuid().optional().allow(null),
  }),
  cliente_id: Joi.when('tipo', {
    is: 'delivery',
    then: Joi.string().uuid().required().messages({
      'any.required': 'El ID de cliente es requerido para órdenes de delivery.',
    }),
    otherwise: Joi.string().uuid().optional().allow(null),
  }),
  notas: Joi.string().max(500).optional().allow('', null),
  porcentaje_descuento: Joi.number().min(0).max(100).optional().default(0).messages({
    'number.min': 'El descuento no puede ser negativo.',
    'number.max': 'El descuento no puede superar el 100%.',
  }),
  propina_porcentaje: Joi.number().min(0).max(100).precision(2).optional().default(10),
  origen: Joi.string()
    .valid('pos', 'hugo', 'pedidosya', 'ubereats', 'whatsapp', 'telefono', 'otro')
    .optional()
    .default('pos')
    .messages({
      'any.only': 'El origen debe ser: pos, hugo, pedidosya, ubereats, whatsapp, telefono u otro.',
    }),
  numero_externo: Joi.string().max(50).optional().allow('', null),
});
