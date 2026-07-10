import Joi from 'joi';

export const movimientoSchema = Joi.object({
  tipo: Joi.string()
    .valid('retiro', 'deposito')
    .required()
    .messages({
      'any.only':    'El tipo debe ser retiro o deposito.',
      'any.required': 'El tipo de movimiento es requerido.',
    }),
  monto: Joi.number().min(0.01).required().messages({
    'number.min':   'El monto debe ser mayor a cero.',
    'any.required': 'El monto es requerido.',
  }),
  motivo: Joi.string().min(3).max(255).required().messages({
    'string.min':   'El motivo debe tener al menos 3 caracteres.',
    'any.required': 'El motivo del movimiento es requerido.',
  }),
  sucursal_id: Joi.string().uuid().optional().allow(null).messages({
    'string.uuid': 'El sucursal_id no tiene un formato UUID válido.',
  }),
});
