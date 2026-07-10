import Joi from 'joi';

export const cambiarEstadoSchema = Joi.object({
  estado: Joi.string()
    .valid('abierta', 'en_proceso', 'lista', 'entregada', 'pagada', 'cancelada')
    .required()
    .messages({
      'any.only': 'Estado inválido.',
      'any.required': 'El estado es requerido.',
    }),
  motivo: Joi.string().max(255).optional().allow('', null),
});
