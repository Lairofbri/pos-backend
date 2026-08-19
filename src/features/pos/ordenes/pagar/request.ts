import Joi from 'joi';

const METODOS_VALIDOS = [
  'efectivo',
  'tarjeta',
  'tarjeta_debito',
  'tarjeta_credito',
  'transferencia',
  'bitcoin',
  'monedero_electronico',
  'cheque',
  'tarjeta_empresarial',
  'bonos',
  'vales',
  'otro',
];

const metodoPagoItem = Joi.object({
  metodo: Joi.string()
    .valid(...METODOS_VALIDOS)
    .required()
    .messages({
      'any.only': 'El método de pago no es válido.',
      'any.required': 'El método de pago es requerido.',
    }),
  monto: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'any.required': 'El monto es requerido.',
      'number.positive': 'El monto debe ser mayor a 0.',
    }),
  referencia: Joi.string().max(100).optional().allow('', null),
  banco: Joi.string().max(100).optional().allow('', null),
  hash: Joi.string().max(100).optional().allow('', null),
  wallet: Joi.string().max(50).optional().allow('', null),
  descripcion: Joi.string().max(255).optional().allow('', null),
});

export const registrarPagoSchema = Joi.object({
  metodos: Joi.array()
    .items(metodoPagoItem)
    .min(1)
    .required()
    .messages({
      'array.min': 'Se requiere al menos un método de pago.',
      'any.required': 'Los métodos de pago son requeridos.',
    }),
});
