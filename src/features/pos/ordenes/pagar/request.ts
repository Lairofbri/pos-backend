import Joi from 'joi';

const METODOS_VALIDOS = [
  'efectivo',
  'tarjeta',
  'tarjeta_debito',
  'tarjeta_credito',
  'mixto',
  'transferencia',
  'bitcoin',
  'monedero_electronico',
  'cheque',
  'tarjeta_empresarial',
  'bonos',
  'vales',
  'otro',
];

export const registrarPagoSchema = Joi.object({
  metodo: Joi.string()
    .valid(...METODOS_VALIDOS)
    .required()
    .messages({
      'any.only': 'El método de pago no es válido.',
      'any.required': 'El método de pago es requerido.',
    }),

  // Monto base para todos
  monto: Joi.when('metodo', {
    is: Joi.valid('efectivo', 'transferencia', 'bitcoin', 'monedero_electronico', 'cheque', 'tarjeta_empresarial', 'bonos', 'vales', 'otro'),
    then: Joi.number().min(0).required().messages({
      'any.required': 'El monto es requerido.',
      'number.min': 'El monto no puede ser negativo.',
    }),
    otherwise: Joi.number().min(0).optional().default(0),
  }),

  // Efectivo
  monto_efectivo: Joi.when('metodo', {
    is: Joi.valid('efectivo', 'mixto'),
    then: Joi.number().min(0).required().messages({
      'any.required': 'El monto en efectivo es requerido.',
      'number.min': 'El monto en efectivo no puede ser negativo.',
    }),
    otherwise: Joi.number().min(0).optional().default(0),
  }),

  // Tarjeta
  monto_tarjeta: Joi.when('metodo', {
    is: Joi.valid('tarjeta', 'tarjeta_debito', 'tarjeta_credito', 'tarjeta_empresarial', 'mixto'),
    then: Joi.number().min(0).required().messages({
      'any.required': 'El monto en tarjeta es requerido.',
      'number.min': 'El monto en tarjeta no puede ser negativo.',
    }),
    otherwise: Joi.number().min(0).optional().default(0),
  }),
  referencia_tarjeta: Joi.string().max(50).optional().allow('', null),

  // Transferencia
  monto_transferencia: Joi.when('metodo', {
    is: 'transferencia',
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional().default(0),
  }),
  referencia_transferencia: Joi.string().max(100).optional().allow('', null),
  banco_emisor: Joi.string().max(100).optional().allow('', null),

  // Bitcoin
  monto_bitcoin: Joi.when('metodo', {
    is: 'bitcoin',
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional().default(0),
  }),
  hash_bitcoin: Joi.string().max(100).optional().allow('', null),
  wallet_id: Joi.string().max(50).optional().allow('', null),

  // Monedero electrónico
  monto_monedero: Joi.when('metodo', {
    is: 'monedero_electronico',
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional().default(0),
  }),


  // Cheque
  monto_cheque: Joi.when('metodo', {
    is: 'cheque',
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional().default(0),
  }),
  referencia_cheque: Joi.string().max(50).optional().allow('', null),

  // Bonos
  monto_bonos: Joi.when('metodo', {
    is: 'bonos',
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional().default(0),
  }),

  // Vales
  monto_vales: Joi.when('metodo', {
    is: 'vales',
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional().default(0),
  }),

  // Otro
  monto_otro: Joi.when('metodo', {
    is: 'otro',
    then: Joi.number().min(0).required(),
    otherwise: Joi.number().min(0).optional().default(0),
  }),
  descripcion_otro: Joi.string().max(255).optional().allow('', null),
});
