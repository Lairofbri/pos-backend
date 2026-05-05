// src/modules/pos/pos.schema.js
// Esquemas de validación Joi — Módulo POS
// Principio S (SOLID): solo valida, no opera ni responde

const Joi = require('joi');

// ─────────────────────────────────────────────
// MESAS
// ─────────────────────────────────────────────

const crearMesaSchema = Joi.object({
  numero:     Joi.string().max(10).required().messages({
    'any.required': 'El número de mesa es requerido.',
  }),
  nombre:     Joi.string().max(50).optional().allow('', null),
  capacidad:  Joi.number().integer().min(1).required().messages({
    'number.min':   'La capacidad debe ser al menos 1.',
    'any.required': 'La capacidad es requerida.',
  }),
  sucursal_id: Joi.string().uuid().optional().allow(null),
});

const actualizarMesaSchema = Joi.object({
  numero:     Joi.string().max(10).optional(),
  nombre:     Joi.string().max(50).optional().allow('', null),
  capacidad:  Joi.number().integer().min(1).optional(),
  activo:     Joi.boolean().optional(),
}).min(1);

// ─────────────────────────────────────────────
// ÓRDENES
// ─────────────────────────────────────────────

const crearOrdenSchema = Joi.object({
  tipo: Joi.string()
    .valid('rapido', 'mesa', 'delivery')
    .required()
    .messages({
      'any.only':    'El tipo debe ser rapido, mesa o delivery.',
      'any.required': 'El tipo de orden es requerido.',
    }),
  mesa_id: Joi.when('tipo', {
    is:        'mesa',
    then:      Joi.string().uuid().required().messages({
      'any.required': 'El ID de mesa es requerido para órdenes de tipo mesa.',
      'string.uuid':  'El ID de mesa no es válido.',
    }),
    otherwise: Joi.string().uuid().optional().allow(null),
  }),
  cliente_id: Joi.when('tipo', {
    is:        'delivery',
    then:      Joi.string().uuid().required().messages({
      'any.required': 'El ID de cliente es requerido para órdenes de delivery.',
    }),
    otherwise: Joi.string().uuid().optional().allow(null),
  }),
  notas:               Joi.string().max(500).optional().allow('', null),
  porcentaje_descuento: Joi.number().min(0).max(100).optional().default(0).messages({
    'number.min': 'El descuento no puede ser negativo.',
    'number.max': 'El descuento no puede superar el 100%.',
  }),
});

const actualizarOrdenSchema = Joi.object({
  notas:               Joi.string().max(500).optional().allow('', null),
  porcentaje_descuento: Joi.number().min(0).max(100).optional().messages({
    'number.min': 'El descuento no puede ser negativo.',
    'number.max': 'El descuento no puede superar el 100%.',
  }),
}).min(1);

const cambiarEstadoSchema = Joi.object({
  estado: Joi.string()
    .valid('abierta', 'en_proceso', 'lista', 'entregada', 'pagada', 'cancelada')
    .required()
    .messages({
      'any.only':    'Estado inválido.',
      'any.required': 'El estado es requerido.',
    }),
  motivo: Joi.string().max(255).optional().allow('', null), // Para cancelaciones
});

// ─────────────────────────────────────────────
// ITEMS DE ORDEN
// ─────────────────────────────────────────────

const agregarItemSchema = Joi.object({
  producto_id: Joi.string().uuid().required().messages({
    'any.required': 'El ID de producto es requerido.',
    'string.uuid':  'El ID de producto no es válido.',
  }),
  cantidad: Joi.number().integer().min(1).required().messages({
    'number.min':   'La cantidad debe ser al menos 1.',
    'any.required': 'La cantidad es requerida.',
  }),
  notas: Joi.string().max(255).optional().allow('', null),
});

const actualizarItemSchema = Joi.object({
  cantidad: Joi.number().integer().min(1).optional().messages({
    'number.min': 'La cantidad debe ser al menos 1.',
  }),
  notas:  Joi.string().max(255).optional().allow('', null),
  estado: Joi.string()
    .valid('pendiente', 'en_proceso', 'listo', 'cancelado')
    .optional()
    .messages({
      'any.only': 'Estado de item inválido.',
    }),
}).min(1);

// ─────────────────────────────────────────────
// PAGOS
// ─────────────────────────────────────────────

const registrarPagoSchema = Joi.object({
  metodo: Joi.string()
    .valid('efectivo', 'tarjeta', 'mixto')
    .required()
    .messages({
      'any.only':    'El método debe ser efectivo, tarjeta o mixto.',
      'any.required': 'El método de pago es requerido.',
    }),
  // Monto en efectivo — requerido si metodo es efectivo o mixto
  monto_efectivo: Joi.when('metodo', {
    is:        Joi.valid('efectivo', 'mixto'),
    then:      Joi.number().min(0).required().messages({
      'any.required': 'El monto en efectivo es requerido.',
      'number.min':   'El monto en efectivo no puede ser negativo.',
    }),
    otherwise: Joi.number().min(0).optional().default(0),
  }),
  // Monto en tarjeta — requerido si metodo es tarjeta o mixto
  monto_tarjeta: Joi.when('metodo', {
    is:        Joi.valid('tarjeta', 'mixto'),
    then:      Joi.number().min(0).required().messages({
      'any.required': 'El monto en tarjeta es requerido.',
      'number.min':   'El monto en tarjeta no puede ser negativo.',
    }),
    otherwise: Joi.number().min(0).optional().default(0),
  }),
  referencia_tarjeta: Joi.string().max(50).optional().allow('', null),
});

// ─────────────────────────────────────────────
// FILTROS para listado de órdenes
// ─────────────────────────────────────────────

const filtrosOrdenesSchema = Joi.object({
  estado:      Joi.string()
    .valid('abierta', 'en_proceso', 'lista', 'entregada', 'pagada', 'cancelada')
    .optional(),
  tipo:        Joi.string().valid('rapido', 'mesa', 'delivery').optional(),
  usuario_id:  Joi.string().uuid().optional(),
  fecha_desde: Joi.date().iso().optional(),
  fecha_hasta: Joi.date().iso().optional(),
  pagina:      Joi.number().integer().min(1).optional().default(1),
  limite:      Joi.number().integer().min(1).max(100).optional().default(50),
});

module.exports = {
  crearMesaSchema,
  actualizarMesaSchema,
  crearOrdenSchema,
  actualizarOrdenSchema,
  cambiarEstadoSchema,
  agregarItemSchema,
  actualizarItemSchema,
  registrarPagoSchema,
  filtrosOrdenesSchema,
};
