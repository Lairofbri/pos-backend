import Joi from 'joi';

export const filtrosOrdenesSchema = Joi.object({
  estado: Joi.string()
    .valid('abierta', 'en_proceso', 'lista', 'entregada', 'pagada', 'cancelada')
    .optional(),
  tipo: Joi.string().valid('rapido', 'mesa', 'delivery').optional(),
  origen: Joi.string()
    .valid('pos', 'hugo', 'pedidosya', 'ubereats', 'whatsapp', 'telefono', 'otro')
    .optional(),
  activas: Joi.boolean().optional().default(false),
  usuario_id: Joi.string().uuid().optional(),
  fecha_desde: Joi.date().iso().optional(),
  fecha_hasta: Joi.date().iso().optional(),
  pagina: Joi.number().integer().min(1).optional().default(1),
  limite: Joi.number().integer().min(1).max(100).optional().default(50),
});
