import Joi from 'joi';

export const resumenDiarioSchema = Joi.object({
  fecha: Joi.date().iso().optional().messages({
    'date.format': 'La fecha debe tener formato ISO (YYYY-MM-DD).',
  }),
});
