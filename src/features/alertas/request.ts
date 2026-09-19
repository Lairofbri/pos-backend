import Joi from 'joi';

const HORA = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).allow(null, '');

export const configAlertasSchema = Joi.object({
  tendencia_caida_pct: Joi.number().min(1).max(50).optional().messages({
    'number.min': 'El umbral de caída debe ser al menos 1%.',
    'number.max': 'El umbral de caída no puede superar 50%.',
  }),
  silencio_desde: HORA.messages({
    'string.pattern.base': 'El horario debe tener formato HH:MM (24h).',
  }),
  silencio_hasta: HORA.messages({
    'string.pattern.base': 'El horario debe tener formato HH:MM (24h).',
  }),
  cooldown_minutos: Joi.number().integer().min(0).max(1440).optional().messages({
    'number.integer': 'El cooldown debe ser un número entero de minutos.',
    'number.min': 'El cooldown no puede ser negativo.',
    'number.max': 'El cooldown no puede superar 1440 minutos (24h).',
  }),
}).min(1);