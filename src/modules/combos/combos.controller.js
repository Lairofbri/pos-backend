// src/modules/combos/combos.controller.js
// Orquesta los requests HTTP del módulo de combos

const service = require('./combos.service');
const { crearComboSchema, actualizarComboSchema } = require('./combos.schema');
const { exito, creado, error, errorServidor } = require('../../utils/response');
const { esUuidValido } = require('../../middlewares/uuid.middleware');
const logger = require('../../utils/logger');

const manejarError = (res, err) => {
  if (err.status && err.mensaje) return error(res, err.mensaje, err.status);
  logger.error('Error no controlado en combos', { error: err.message, stack: err.stack });
  return errorServidor(res);
};

const listarCombos = async (req, res) => {
  try {
    const soloActivos = req.usuario.rol !== 'administrador' || req.query.todas !== 'true';
    const combos = await service.listarCombos({ tenantId: req.usuario.tenant_id, soloActivos });
    return exito(res, combos);
  } catch (err) { return manejarError(res, err); }
};

const obtenerCombo = async (req, res) => {
  if (!esUuidValido(req.params.id)) return error(res, 'El ID de combo no tiene un formato UUID válido.', 400);
  try {
    const combo = await service.obtenerCombo({ tenantId: req.usuario.tenant_id, comboId: req.params.id });
    return exito(res, combo);
  } catch (err) { return manejarError(res, err); }
};

const crearCombo = async (req, res) => {
  const { error: validacionError, value } = crearComboSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);
  try {
    const combo = await service.crearCombo({ tenantId: req.usuario.tenant_id, datos: value });
    return creado(res, combo, 'Combo creado exitosamente.');
  } catch (err) { return manejarError(res, err); }
};

const actualizarCombo = async (req, res) => {
  if (!esUuidValido(req.params.id)) return error(res, 'El ID de combo no tiene un formato UUID válido.', 400);
  const { error: validacionError, value } = actualizarComboSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);
  try {
    const combo = await service.actualizarCombo({ tenantId: req.usuario.tenant_id, comboId: req.params.id, datos: value });
    return exito(res, combo, 'Combo actualizado exitosamente.');
  } catch (err) { return manejarError(res, err); }
};

const desactivarCombo = async (req, res) => {
  if (!esUuidValido(req.params.id)) return error(res, 'El ID de combo no tiene un formato UUID válido.', 400);
  try {
    await service.desactivarCombo({ tenantId: req.usuario.tenant_id, comboId: req.params.id });
    return exito(res, null, 'Combo desactivado exitosamente.');
  } catch (err) { return manejarError(res, err); }
};

module.exports = { listarCombos, obtenerCombo, crearCombo, actualizarCombo, desactivarCombo };
