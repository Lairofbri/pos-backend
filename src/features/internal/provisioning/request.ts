import Joi from 'joi';

// Eventos de provisión que el POS acepta del DTE Service
// (Fase 2 + Fase 3 + USUARIO_INICIAL 2026-10-07).
export const TIPOS_EVENTO_POS = ['TENANT_CREADO', 'BRANCH_VINCULADO', 'USUARIO_INICIAL'];

const ESTADOS_FISCAL_SUCURSAL = ['pending_link', 'pending_mh_data', 'ready', 'inactive', 'blocked'];

// Payload del evento TENANT_CREADO (Fase 2).
const payloadTenantEvento = Joi.object({
  nombre: Joi.string().trim().min(2).max(150).required(),
  nombre_comercial: Joi.string().trim().max(150).allow('', null).optional(),
  nit: Joi.string().trim().min(5).max(20).required(),
  nrc: Joi.string().trim().max(20).allow('', null).optional(),
  email: Joi.string().email({ tlds: { allow: false } }).max(150).allow('', null).optional(),
});

// Payload del evento BRANCH_VINCULADO (Fase 3): datos fiscales de LECTURA
// para la proyección operativa POS. NUNCA credenciales Hacienda.
const payloadBranchEvento = Joi.object({
  branch_id: Joi.string().uuid().required().messages({
    'any.required': 'branch_id es requerido en el payload.',
    'string.guid': 'branch_id debe ser un UUID válido.',
  }),
  establecimiento_id: Joi.string().uuid().required().messages({
    'any.required': 'establecimiento_id es requerido en el payload.',
    'string.guid': 'establecimiento_id debe ser un UUID válido.',
  }),
  fiscal_status: Joi.string()
    .valid(...ESTADOS_FISCAL_SUCURSAL)
    .required()
    .messages({
      'any.required': 'fiscal_status es requerido en el payload.',
      'any.only': `fiscal_status debe ser uno de: ${ESTADOS_FISCAL_SUCURSAL.join(', ')}.`,
    }),
  nombre: Joi.string().trim().min(2).max(150).required(),
  direccion: Joi.string().trim().max(255).allow('', null).optional(),
  telefono: Joi.string().trim().max(20).allow('', null).optional(),
  cod_estable_mh: Joi.string().trim().allow('', null).optional(),
  cod_punto_venta_mh: Joi.string().trim().allow('', null).optional(),
  tipo_establecimiento: Joi.string().valid('01', '02', '04', '07').allow(null).optional(),
  departamento_cod: Joi.string().length(2).allow('', null).optional(),
  municipio_cod: Joi.string().length(2).allow('', null).optional(),
  sync_error: Joi.string().trim().max(500).allow('', null).optional(),
});

// Payload del evento USUARIO_INICIAL (2026-10-07): SOLO hashes bcrypt.
// La contraseña y el PIN en claro NUNCA llegan al POS; Joi rechaza cualquier
// clave extra (allowUnknown=false), incluyendo un hipotético "password" plano.
const payloadUsuarioInicialEvento = Joi.object({
  nombre: Joi.string().trim().min(2).max(100).required(),
  apellido: Joi.string().trim().max(100).allow('', null).optional(),
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().max(150).required(),
  rol: Joi.string().valid('administrador').required(),
  password_hash: Joi.string()
    .pattern(/^\$2[aby]\$\d{2}\$/)
    .required()
    .messages({
      'string.pattern.base': 'password_hash debe ser un hash bcrypt.',
    }),
  pin_hash: Joi.string()
    .pattern(/^\$2[aby]\$\d{2}\$/)
    .required()
    .messages({
      'string.pattern.base': 'pin_hash debe ser un hash bcrypt.',
    }),
});

export const recibirEventoSchema = Joi.object({
  operation_id: Joi.string().uuid().required().messages({
    'any.required': 'operation_id es requerido.',
    'string.guid': 'operation_id debe ser un UUID v4 válido.',
  }),
  tenant_id: Joi.string().uuid().required().messages({
    'any.required': 'tenant_id es requerido.',
    'string.guid': 'tenant_id debe ser un UUID válido.',
  }),
  branch_id: Joi.string().uuid().allow(null).optional().messages({
    'string.guid': 'branch_id debe ser un UUID válido.',
  }),
  tipo_evento: Joi.string()
    .valid(...TIPOS_EVENTO_POS)
    .required()
    .messages({
      'any.required': 'tipo_evento es requerido.',
      'any.only': `tipo_evento debe ser uno de: ${TIPOS_EVENTO_POS.join(', ')}.`,
    }),
  payload: Joi.alternatives().conditional('tipo_evento', {
    switch: [
      { is: 'TENANT_CREADO', then: payloadTenantEvento.required() },
      { is: 'BRANCH_VINCULADO', then: payloadBranchEvento.required() },
      { is: 'USUARIO_INICIAL', then: payloadUsuarioInicialEvento.required() },
    ],
  }),
});