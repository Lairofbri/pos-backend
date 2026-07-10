import Joi from 'joi';

const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
const nrcRegex = /^\d{1,7}(-\d)?$/;
const telefonoRegex = /^(\+503\s?)?[267]\d{3}-?\d{4}$/;

export const crearClienteSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required().messages({
    'string.min': 'El nombre debe tener al menos 2 caracteres.',
    'any.required': 'El nombre es requerido.',
  }),
  apellido: Joi.string().max(100).optional().allow('', null),
  telefono: Joi.string().pattern(telefonoRegex).optional().allow('', null).messages({
    'string.pattern.base': 'El teléfono no tiene un formato válido. Ej: 7777-1234',
  }),
  email: Joi.string().email({ tlds: { allow: false } }).lowercase()
    .optional().allow('', null).messages({
      'string.email': 'El email no tiene un formato válido.',
    }),
  tipo_documento: Joi.string()
    .valid('dui', 'nit', 'pasaporte', 'carnet_residente')
    .optional().default('dui').messages({
      'any.only': 'El tipo de documento debe ser dui, nit, pasaporte o carnet_residente.',
    }),
  numero_documento: Joi.string().max(20).optional().allow('', null),
  nit: Joi.string().pattern(nitRegex).optional().allow('', null).messages({
    'string.pattern.base': 'El NIT debe tener el formato 0000-000000-000-0.',
  }),
  nrc: Joi.string().pattern(nrcRegex).optional().allow('', null).messages({
    'string.pattern.base': 'El NRC no tiene un formato válido.',
  }),
  razon_social: Joi.string().max(200).optional().allow('', null),
  direccion: Joi.string().max(255).optional().allow('', null),
  municipio: Joi.string().max(100).optional().allow('', null),
  departamento: Joi.string().max(100).optional().allow('', null),
});
