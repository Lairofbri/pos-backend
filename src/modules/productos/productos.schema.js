// src/modules/productos/productos.schema.js
// Esquemas de validación con Joi — Módulo de Productos
// Principio S (SOLID): este archivo solo valida, no opera ni responde

const Joi = require('joi');

// ─────────────────────────────────────────────
// CATEGORÍAS
// ─────────────────────────────────────────────

/**
 * Schema para crear una categoría nueva
 */
const crearCategoriaSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres.',
    'any.required': 'El nombre de la categoría es requerido.',
  }),
  descripcion: Joi.string().max(255).optional().allow('', null),
  orden: Joi.number().integer().min(0).optional().default(0),
  color: Joi.string()
    .pattern(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .allow('', null)
    .messages({
      'string.pattern.base': 'El color debe ser un valor hexadecimal válido. Ej: #FF5733',
    }),
});

/**
 * Schema para actualizar una categoría existente
 * Todos los campos son opcionales pero debe venir al menos uno
 */
const actualizarCategoriaSchema = Joi.object({
  nombre:      Joi.string().min(2).max(100).optional(),
  descripcion: Joi.string().max(255).optional().allow('', null),
  orden:       Joi.number().integer().min(0).optional(),
  color:       Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional().allow('', null),
  activo:      Joi.boolean().optional(),
}).min(1);

// ─────────────────────────────────────────────
// PRODUCTOS
// ─────────────────────────────────────────────

/**
 * Schema para crear un producto nuevo
 */
const crearProductoSchema = Joi.object({
  nombre: Joi.string().min(2).max(150).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres.',
    'any.required': 'El nombre del producto es requerido.',
  }),
  descripcion:  Joi.string().max(500).optional().allow('', null),
  precio: Joi.number().precision(2).min(0).required().messages({
    'number.min':  'El precio no puede ser negativo.',
    'any.required': 'El precio es requerido.',
  }),
  categoria_id: Joi.string().uuid().optional().allow(null).messages({
    'string.uuid': 'El ID de categoría no es válido.',
  }),
  imagen_url:   Joi.string().uri().max(500).optional().allow('', null).messages({
    'string.uri': 'La imagen debe ser una URL válida.',
  }),
  tiene_stock:  Joi.boolean().optional().default(false),
  stock_actual: Joi.number().integer().min(0).optional().default(0),
  stock_minimo: Joi.number().integer().min(0).optional().default(0),
  codigo:       Joi.string().max(50).optional().allow('', null),
  orden:        Joi.number().integer().min(0).optional().default(0),
});

/**
 * Schema para actualizar un producto existente
 * Todos los campos son opcionales pero debe venir al menos uno
 */
const actualizarProductoSchema = Joi.object({
  nombre:       Joi.string().min(2).max(150).optional(),
  descripcion:  Joi.string().max(500).optional().allow('', null),
  precio:       Joi.number().precision(2).min(0).optional(),
  categoria_id: Joi.string().uuid().optional().allow(null),
  imagen_url:   Joi.string().uri().max(500).optional().allow('', null),
  tiene_stock:  Joi.boolean().optional(),
  stock_actual: Joi.number().integer().min(0).optional(),
  stock_minimo: Joi.number().integer().min(0).optional(),
  codigo:       Joi.string().max(50).optional().allow('', null),
  orden:        Joi.number().integer().min(0).optional(),
  activo:       Joi.boolean().optional(),
}).min(1);

/**
 * Schema para ajuste rápido de stock
 */
const ajustarStockSchema = Joi.object({
  cantidad: Joi.number().integer().required().messages({
    'any.required': 'La cantidad es requerida.',
  }),
  // tipo: 'suma' agrega al stock, 'resta' descuenta, 'absoluto' establece el valor exacto
  tipo: Joi.string()
    .valid('suma', 'resta', 'absoluto')
    .required()
    .messages({
      'any.only': 'El tipo debe ser suma, resta o absoluto.',
    }),
  motivo: Joi.string().max(255).optional().allow('', null),
});

/**
 * Schema para filtros de listado de productos
 */
const filtrosProductosSchema = Joi.object({
  categoria_id: Joi.string().uuid().optional(),
  activo:       Joi.boolean().optional(),
  busqueda:     Joi.string().max(100).optional().allow(''),
  con_stock:    Joi.boolean().optional(),  // true = solo productos con stock > 0
  pagina:       Joi.number().integer().min(1).optional().default(1),
  limite:       Joi.number().integer().min(1).max(100).optional().default(50),
});

module.exports = {
  crearCategoriaSchema,
  actualizarCategoriaSchema,
  crearProductoSchema,
  actualizarProductoSchema,
  ajustarStockSchema,
  filtrosProductosSchema,
};
