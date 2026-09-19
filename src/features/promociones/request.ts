import Joi from 'joi';

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const base = {
  nombre: Joi.string().max(100).required(),
  tipo: Joi.string().valid('porcentaje', 'dosxuno', 'volumen', 'happy_hour').required(),
  descuento_porcentaje: Joi.number().min(0).max(100).optional().allow(null),
  volumen_minimo: Joi.number().integer().min(1).optional().allow(null),
  hora_inicio: Joi.string().pattern(HORA).optional().allow('', null),
  hora_fin: Joi.string().pattern(HORA).optional().allow('', null),
  dias: Joi.array().items(Joi.number().integer().min(0).max(6)).optional().allow(null),
  vigente_desde: Joi.date().iso().optional().allow('', null),
  vigente_hasta: Joi.date().iso().optional().allow('', null),
  activo: Joi.boolean().optional(),
  productos: Joi.array().items(Joi.string().uuid()).optional(),
};

const validarTipo = (value: Record<string, unknown>, helpers: Joi.CustomHelpers) => {
  const { tipo, descuento_porcentaje } = value;
  if (tipo !== 'dosxuno' && (descuento_porcentaje === undefined || descuento_porcentaje === null)) {
    return helpers.error('any.required', { message: `El tipo "${tipo}" requiere descuento_porcentaje.` });
  }
  if (tipo === 'dosxuno' && descuento_porcentaje !== undefined && descuento_porcentaje !== null) {
    return helpers.error('any.invalid', { message: 'El tipo "dosxuno" no usa descuento_porcentaje.' });
  }
  return value;
};

export const crearPromocionSchema = Joi.object({
  ...base,
  productos: Joi.array().items(Joi.string().uuid()).optional(),
}).custom(validarTipo, 'Validación de tipo de promoción');

export const actualizarPromocionSchema = Joi.object({
  nombre: Joi.string().max(100).optional(),
  tipo: Joi.string().valid('porcentaje', 'dosxuno', 'volumen', 'happy_hour').optional(),
  descuento_porcentaje: Joi.number().min(0).max(100).optional().allow(null),
  volumen_minimo: Joi.number().integer().min(1).optional().allow(null),
  hora_inicio: Joi.string().pattern(HORA).optional().allow('', null),
  hora_fin: Joi.string().pattern(HORA).optional().allow('', null),
  dias: Joi.array().items(Joi.number().integer().min(0).max(6)).optional().allow(null),
  vigente_desde: Joi.date().iso().optional().allow('', null),
  vigente_hasta: Joi.date().iso().optional().allow('', null),
  activo: Joi.boolean().optional(),
  productos: Joi.array().items(Joi.string().uuid()).optional(),
}).min(1).messages({ 'object.min': 'Debe enviar al menos un campo para actualizar.' });

export const reportePromocionesSchema = Joi.object({
  desde: Joi.date().iso().optional(),
  hasta: Joi.date().iso().optional(),
});
