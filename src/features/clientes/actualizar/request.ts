import Joi from 'joi';

const nitRegex = /^\d{4}-\d{6}-\d{3}-\d{1}$/;
const nrcRegex = /^\d{1,7}(-\d)?$/;
const telefonoRegex = /^(\+503\s?)?[267]\d{3}-?\d{4}$/;

export const actualizarClienteSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).optional(),
  apellido: Joi.string().max(100).optional().allow('', null),
  telefono: Joi.string().pattern(telefonoRegex).optional().allow('', null),
  email: Joi.string().email({ tlds: { allow: false } }).lowercase().optional().allow('', null),
  tipo_documento: Joi.string().valid('dui', 'nit', 'pasaporte', 'carnet_residente').optional(),
  numero_documento: Joi.string().max(20).optional().allow('', null),
  nit: Joi.string().pattern(nitRegex).optional().allow('', null),
  nrc: Joi.string().pattern(nrcRegex).optional().allow('', null),
  razon_social: Joi.string().max(200).optional().allow('', null),
  direccion: Joi.string().max(255).optional().allow('', null),
  municipio: Joi.string().max(100).optional().allow('', null),
  departamento: Joi.string().max(100).optional().allow('', null),
  activo: Joi.boolean().optional(),
}).min(1);
