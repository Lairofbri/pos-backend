// src/modules/impresion/impresion.controller.js
// Orquesta los requests HTTP del módulo de impresión

const service = require('./impresion.service');
const { exito, error, errorServidor } = require('../../utils/response');
const { esUuidValido } = require('../../middlewares/uuid.middleware');
const logger = require('../../utils/logger');

const manejarError = (res, err) => {
  if (err.status && err.mensaje) return error(res, err.mensaje, err.status);
  logger.error('Error no controlado en impresion', { error: err.message, stack: err.stack });
  return errorServidor(res);
};

const listar = async (req, res) => {
  try {
    const impresoras = await service.listar(req.usuario.tenant_id);
    return exito(res, impresoras);
  } catch (err) { return manejarError(res, err); }
};

const crear = async (req, res) => {
  try {
    const impresora = await service.crear(req.usuario.tenant_id, req.body);
    return exito(res, impresora, 201);
  } catch (err) { return manejarError(res, err); }
};

const actualizar = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'ID de impresora invalido.', 400);
  }
  try {
    const impresora = await service.actualizar(req.usuario.tenant_id, req.params.id, req.body);
    return exito(res, impresora);
  } catch (err) { return manejarError(res, err); }
};

const eliminar = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'ID de impresora invalido.', 400);
  }
  try {
    await service.eliminar(req.usuario.tenant_id, req.params.id);
    return exito(res, { eliminado: true });
  } catch (err) { return manejarError(res, err); }
};

const imprimir = async (req, res) => {
  if (!esUuidValido(req.params.ordenId)) {
    return error(res, 'El ID de orden no tiene un formato UUID valido.', 400);
  }

  const { tipo, impresora_id } = req.body;
  if (!tipo || !['pre-cuenta', 'ticket-consumo', 'factura'].includes(tipo)) {
    return error(res, 'Tipo de ticket requerido: pre-cuenta, ticket-consumo o factura.', 400);
  }

  try {
    const resultado = await service.imprimirTicket({
      tenantId: req.usuario.tenant_id,
      ordenId: req.params.ordenId,
      tipo,
      impresoraId: impresora_id || null,
    });
    return exito(res, resultado);
  } catch (err) { return manejarError(res, err); }
};

const imprimirPrueba = async (req, res) => {
  const { impresora_id } = req.body;
  if (!impresora_id) return error(res, 'impresora_id es requerido.', 400);

  try {
    const resultado = await service.imprimirPrueba(req.usuario.tenant_id, impresora_id);
    return exito(res, resultado);
  } catch (err) { return manejarError(res, err); }
};

module.exports = {
  listar,
  crear,
  actualizar,
  eliminar,
  imprimir,
  imprimirPrueba,
};
