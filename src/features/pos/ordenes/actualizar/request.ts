import Joi from 'joi';

export const actualizarOrdenSchema = Joi.object({
  notas: Joi.string().max(500).optional().allow('', null),
  porcentaje_descuento: Joi.number().min(0).max(100).optional().messages({
    'number.min': 'El descuento no puede ser negativo.',
    'number.max': 'El descuento no puede superar el 100%.',
  }),
  propina_porcentaje: Joi.number().min(0).max(100).precision(2).optional(),
  propina_monto: Joi.number().min(0).precision(2).optional(),
  origen: Joi.string()
    .valid('pos', 'hugo', 'pedidosya', 'ubereats', 'whatsapp', 'telefono', 'otro')
    .optional(),
  numero_externo: Joi.string().max(50).optional().allow('', null),
}).min(1);
