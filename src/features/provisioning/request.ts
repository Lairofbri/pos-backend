import Joi from 'joi';

export const crearTenantPosSchema = Joi.object({
  tenant_id: Joi.string().uuid().required().messages({
    'any.required': 'tenant_id es requerido.',
    'string.guid': 'tenant_id debe ser un UUID v4 válido.',
  }),
  operation_id: Joi.string().uuid().required().messages({
    'any.required': 'operation_id es requerido (o el header Idempotency-Key).',
    'string.guid': 'operation_id debe ser un UUID v4 válido.',
  }),
  nombre: Joi.string().trim().min(2).max(150).required().messages({
    'any.required': 'El nombre de la empresa es requerido.',
    'string.min': 'El nombre debe tener al menos 2 caracteres.',
    'string.max': 'El nombre no puede exceder los 150 caracteres.',
  }),
  nit: Joi.string().trim().min(5).max(20).required().messages({
    'any.required': 'El NIT es requerido.',
    'string.min': 'El NIT debe tener al menos 5 caracteres.',
    'string.max': 'El NIT no puede exceder los 20 caracteres.',
  }),
  nrc: Joi.string().trim().min(4).max(20).allow('', null).optional().messages({
    'string.max': 'El NRC no puede exceder los 20 caracteres.',
  }),
  email: Joi.string().email().max(150).allow('', null).optional().messages({
    'string.email': 'El email debe tener un formato válido.',
    'string.max': 'El email no puede exceder los 150 caracteres.',
  }),
});