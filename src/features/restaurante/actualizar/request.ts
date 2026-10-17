import Joi from 'joi';

/**
 * PUT /api/v1/restaurante — F2 (2026-10-16).
 *
 * El POS ya NO edita datos de EMPRESA: la identidad fiscal (nombre, NIT, NRC,
 * dirección, teléfono, email, logo) se administra en el DTE Service.
 * El único campo editable aquí es la preferencia OPERATIVA del POS
 * (`pos_default_mode`, decisión §7.3 del spec «DTE única fuente de verdad»).
 *
 * Los campos de empresa se rechazan en el handler con 409 y mensaje explícito
 * ANTES de validar, para no devolver un error genérico de Joi.
 */
export const actualizarRestauranteSchema = Joi.object({
  pos_default_mode: Joi.string().valid('mesas', 'rapido').optional(),
}).min(1).messages({ 'object.min': 'Debe enviar al menos un campo para actualizar.' });
