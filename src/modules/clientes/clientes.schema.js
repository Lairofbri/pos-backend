// src/modules/clientes/clientes.schema.js
// Esquemas de validación Joi — Módulo Clientes
// Principio S (SOLID): solo valida, no opera ni responde

const Joi = require('joi');

// ─────────────────────────────────────────────
// Validadores reutilizables El Salvador
// ─────────────────────────────────────────────

// NIT El Salvador: formato 0000-000000-000-0
const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;

// NRC El Salvador: 1 a 7 dígitos con guión opcional
const nrcRegex = /^\d{1,7}(-\d)?$/;

// DUI El Salvador: 00000000-0
const duiRegex = /^\d{8}-\d{1}$/;

// Teléfono El Salvador: 8 dígitos con formato opcional
const telefonoRegex = /^(\+503\s?)?[267]\d{3}-?\d{4}$/;

// ─────────────────────────────────────────────
// Schema para crear un cliente
// ─────────────────────────────────────────────
const crearClienteSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required().messages({
    'string.min':   'El nombre debe tener al menos 2 caracteres.',
    'any.required': 'El nombre es requerido.',
  }),
  apellido:  Joi.string().max(100).optional().allow('', null),
  telefono:  Joi.string().pattern(telefonoRegex).optional().allow('', null).messages({
    'string.pattern.base': 'El teléfono no tiene un formato válido. Ej: 7777-1234',
  }),
  email: Joi.string().email({ tlds: { allow: false } }).lowercase()
    .optional().allow('', null).messages({
      'string.email': 'El email no tiene un formato válido.',
    }),

  // Documento de identidad
  tipo_documento: Joi.string()
    .valid('dui', 'nit', 'pasaporte', 'carnet_residente')
    .optional()
    .default('dui')
    .messages({
      'any.only': 'El tipo de documento debe ser dui, nit, pasaporte o carnet_residente.',
    }),
  numero_documento: Joi.string().max(20).optional().allow('', null),

  // Datos fiscales — requeridos para CCF
  nit: Joi.string().pattern(nitRegex).optional().allow('', null).messages({
    'string.pattern.base': 'El NIT debe tener el formato 0000-000000-000-0.',
  }),
  nrc: Joi.string().pattern(nrcRegex).optional().allow('', null).messages({
    'string.pattern.base': 'El NRC no tiene un formato válido.',
  }),
  razon_social: Joi.string().max(200).optional().allow('', null),

  // Dirección
  direccion:    Joi.string().max(255).optional().allow('', null),
  municipio:    Joi.string().max(100).optional().allow('', null),
  departamento: Joi.string().max(100).optional().allow('', null),
});

// ─────────────────────────────────────────────
// Schema para actualizar un cliente
// Todos los campos opcionales, mínimo uno
// ─────────────────────────────────────────────
const actualizarClienteSchema = Joi.object({
  nombre:           Joi.string().min(2).max(100).optional(),
  apellido:         Joi.string().max(100).optional().allow('', null),
  telefono:         Joi.string().pattern(telefonoRegex).optional().allow('', null),
  email:            Joi.string().email({ tlds: { allow: false } }).lowercase().optional().allow('', null),
  tipo_documento:   Joi.string().valid('dui', 'nit', 'pasaporte', 'carnet_residente').optional(),
  numero_documento: Joi.string().max(20).optional().allow('', null),
  nit:              Joi.string().pattern(nitRegex).optional().allow('', null),
  nrc:              Joi.string().pattern(nrcRegex).optional().allow('', null),
  razon_social:     Joi.string().max(200).optional().allow('', null),
  direccion:        Joi.string().max(255).optional().allow('', null),
  municipio:        Joi.string().max(100).optional().allow('', null),
  departamento:     Joi.string().max(100).optional().allow('', null),
  activo:           Joi.boolean().optional(),
}).min(1);

// ─────────────────────────────────────────────
// Schema para filtros de búsqueda
// Usado en GET /api/clientes y GET /api/clientes/buscar
// ─────────────────────────────────────────────
const filtrosClientesSchema = Joi.object({
  // Búsqueda de texto libre — busca en nombre, apellido, NIT, DUI, razón social
  q:       Joi.string().max(100).optional().allow(''),
  activo:  Joi.boolean().optional(),
  pagina:  Joi.number().integer().min(1).optional().default(1),
  limite:  Joi.number().integer().min(1).max(100).optional().default(20),
});

module.exports = {
  crearClienteSchema,
  actualizarClienteSchema,
  filtrosClientesSchema,
};
