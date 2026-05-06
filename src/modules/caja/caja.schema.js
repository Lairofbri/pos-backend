// src/modules/caja/caja.schema.js
// Esquemas de validación Joi — Módulo Caja
// Principio S (SOLID): solo valida, no opera ni responde

const Joi = require('joi');

/**
 * Schema para abrir una caja
 */
const abrirCajaSchema = Joi.object({
  monto_inicial: Joi.number().min(0).required().messages({
    'number.min':   'El monto inicial no puede ser negativo.',
    'any.required': 'El monto inicial es requerido.',
  }),
  sucursal_id: Joi.string().uuid().optional().allow(null),
  notas:       Joi.string().max(500).optional().allow('', null),
});

/**
 * Schema para cerrar una caja
 * El cajero cuenta el efectivo físico y lo registra
 */
const cerrarCajaSchema = Joi.object({
  monto_final: Joi.number().min(0).required().messages({
    'number.min':   'El monto final no puede ser negativo.',
    'any.required': 'El monto contado es requerido para cerrar la caja.',
  }),
  notas_cierre: Joi.string().max(500).optional().allow('', null),
});

/**
 * Schema para registrar un movimiento manual
 * Retiros: sacar dinero de la caja (gastos, pagos a proveedores)
 * Depósitos: agregar dinero a la caja (cambio, fondo adicional)
 */
const movimientoSchema = Joi.object({
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
});

/**
 * Schema para filtros del historial de cajas
 */
const filtrosCajaSchema = Joi.object({
  estado:      Joi.string().valid('abierta', 'cerrada').optional(),
  fecha_desde: Joi.date().iso().optional(),
  fecha_hasta: Joi.date().iso().optional(),
  pagina:      Joi.number().integer().min(1).optional().default(1),
  limite:      Joi.number().integer().min(1).max(100).optional().default(20),
});

module.exports = {
  abrirCajaSchema,
  cerrarCajaSchema,
  movimientoSchema,
  filtrosCajaSchema,
};
