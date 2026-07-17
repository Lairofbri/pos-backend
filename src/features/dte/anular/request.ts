import Joi from 'joi';

export const anularDTESchema = Joi.object({
  codigo_generacion: Joi.string().uuid().required().messages({
    'any.required': 'El código de generación del DTE es requerido.',
    'string.uuid': 'El código de generación debe ser un UUID válido.',
  }),
  tipo_dte: Joi.string().valid('01', '03', '05', '06', '14').required().messages({
    'any.required': 'El tipo de DTE es requerido.',
  }),
  motivo_tipo: Joi.number().integer().valid(1, 2, 3).required().messages({
    'any.required': 'El tipo de anulación es requerido (1=Error datos, 2=Rescindir, 3=Otro).',
    'any.only': 'motivo_tipo debe ser 1, 2 o 3.',
  }),
  motivo_descripcion: Joi.string().min(5).max(250).required().messages({
    'any.required': 'La descripción del motivo de anulación es requerida.',
    'string.min': 'La descripción debe tener al menos 5 caracteres.',
  }),
  nombre_responsable: Joi.string().min(1).max(100).required(),
  tipo_doc_responsable: Joi.string().valid('13', '02', '03', '36', '37').required(),
  num_doc_responsable: Joi.string().min(3).max(25).required(),
  password_pri: Joi.string().min(1).required().messages({
    'any.required': 'La contraseña del certificado (password_pri) es requerida.',
  }),
}).required();

export type AnularDTEBody = {
  codigo_generacion: string;
  tipo_dte: string;
  motivo_tipo: number;
  motivo_descripcion: string;
  nombre_responsable: string;
  tipo_doc_responsable: string;
  num_doc_responsable: string;
  password_pri: string;
};
