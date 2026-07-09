import Joi from 'joi';

export const crearMesaSchema = Joi.object({
  numero: Joi.string().max(10).required().messages({
    'any.required': 'El número de mesa es requerido.',
  }),
  nombre: Joi.string().max(50).optional().allow('', null),
  capacidad: Joi.number().integer().min(1).required().messages({
    'number.min': 'La capacidad debe ser al menos 1.',
    'any.required': 'La capacidad es requerida.',
  }),
  zona: Joi.string().max(50).optional().allow('', null),
  sucursal_id: Joi.string().uuid().optional().allow(null),
});
