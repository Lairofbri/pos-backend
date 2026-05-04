// src/modules/auth/auth.schema.js
// Esquemas de validación con Joi para todos los endpoints de auth
// Joi lanza un error descriptivo si el body no cumple el esquema

const Joi = require('joi');

// ─────────────────────────────────────────────
// Login con email + password (panel administrador web)
// ─────────────────────────────────────────────
const loginEmailSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().required(),
  password: Joi.string().min(6).required().messages({
    'string.min': 'La contraseña debe tener al menos 6 caracteres.',
    'any.required': 'La contraseña es requerida.',
  }),
  // Información del dispositivo para registrar el refresh token
  dispositivo: Joi.string().max(255).optional(),
});

// ─────────────────────────────────────────────
// Login con PIN (estaciones POS — login rápido)
// El tenant_id viene en el header X-Tenant-Id
// ─────────────────────────────────────────────
const loginPinSchema = Joi.object({
  usuario_id: Joi.string().uuid().required().messages({
    'string.uuid': 'ID de usuario inválido.',
    'any.required': 'El ID de usuario es requerido.',
  }),
  pin: Joi.string()
    .pattern(/^\d{4,6}$/)
    .required()
    .messages({
      'string.pattern.base': 'El PIN debe tener entre 4 y 6 dígitos numéricos.',
      'any.required': 'El PIN es requerido.',
    }),
  dispositivo: Joi.string().max(255).optional(),
});

// ─────────────────────────────────────────────
// Refresh de token JWT
// ─────────────────────────────────────────────
const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required().messages({
    'any.required': 'El refresh token es requerido.',
  }),
});

// ─────────────────────────────────────────────
// Cambio de PIN (el usuario autenticado cambia su propio PIN)
// ─────────────────────────────────────────────
const cambiarPinSchema = Joi.object({
  pin_actual: Joi.string()
    .pattern(/^\d{4,6}$/)
    .required()
    .messages({
      'string.pattern.base': 'El PIN actual debe tener entre 4 y 6 dígitos.',
      'any.required': 'El PIN actual es requerido.',
    }),
  pin_nuevo: Joi.string()
    .pattern(/^\d{4,6}$/)
    .required()
    .messages({
      'string.pattern.base': 'El PIN nuevo debe tener entre 4 y 6 dígitos.',
      'any.required': 'El PIN nuevo es requerido.',
    }),
});

// ─────────────────────────────────────────────
// Cambio de password (solo admin, vía panel web)
// ─────────────────────────────────────────────
const cambiarPasswordSchema = Joi.object({
  password_actual: Joi.string().min(6).required(),
  password_nuevo: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.pattern.base':
        'El password nuevo debe tener al menos 8 caracteres, una mayúscula y un número.',
    }),
});

// ─────────────────────────────────────────────
// Creación de usuario (solo administrador)
// ─────────────────────────────────────────────
const crearUsuarioSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required(),
  apellido: Joi.string().min(2).max(100).optional().allow(''),
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().optional().allow('', null),
  pin: Joi.string()
    .pattern(/^\d{4,6}$/)
    .required()
    .messages({
      'string.pattern.base': 'El PIN debe tener entre 4 y 6 dígitos numéricos.',
    }),
  password: Joi.string().min(8).optional().allow('', null), // Solo si es admin con acceso web
  rol: Joi.string()
    .valid('administrador', 'cajero', 'mesero')
    .required()
    .messages({
      'any.only': 'El rol debe ser administrador, cajero o mesero.',
    }),
  sucursal_id: Joi.string().uuid().optional().allow(null),
});

// ─────────────────────────────────────────────
// Actualizar usuario existente (solo administrador)
// ─────────────────────────────────────────────
const actualizarUsuarioSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).optional(),
  apellido: Joi.string().min(2).max(100).optional().allow(''),
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().optional().allow('', null),
  rol: Joi.string().valid('administrador', 'cajero', 'mesero').optional(),
  sucursal_id: Joi.string().uuid().optional().allow(null),
  activo: Joi.boolean().optional(),
}).min(1); // Al menos un campo requerido

module.exports = {
  loginEmailSchema,
  loginPinSchema,
  refreshTokenSchema,
  cambiarPinSchema,
  cambiarPasswordSchema,
  crearUsuarioSchema,
  actualizarUsuarioSchema,
};
