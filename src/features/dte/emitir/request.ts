import Joi from 'joi';

export const emitirDTESchema = Joi.object({
  orden_id: Joi.string().uuid().required().messages({
    'any.required': 'El ID de la orden es requerido.',
    'string.uuid': 'El ID de la orden debe ser un UUID válido.',
  }),
  tipo_dte: Joi.string().valid('01', '03', '14').default('01').messages({
    'any.only': 'El tipo de DTE debe ser 01 (FCF), 03 (CCF) o 14 (FSE).',
  }),
}).required();

export type EmitirDTEBody = {
  orden_id: string;
  tipo_dte: string;
};
