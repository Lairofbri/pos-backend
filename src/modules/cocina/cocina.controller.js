// src/modules/cocina/cocina.controller.js
// Orquesta los requests HTTP del módulo de cocina

const service = require('./cocina.service');
const { exito, error, errorServidor } = require('../../utils/response');
const { esUuidValido } = require('../../middlewares/uuid.middleware');
const logger = require('../../utils/logger');

const manejarError = (res, err) => {
  if (err.status && err.mensaje) return error(res, err.mensaje, err.status);
  logger.error('Error no controlado en cocina', { error: err.message, stack: err.stack });
  return errorServidor(res);
};

/**
 * GET /api/cocina
 * Lista items activos en cocina agrupados por orden
 */
const listarItems = async (req, res) => {
  try {
    const soloPendientes = req.query.pendientes === 'true';
    const items = await service.listarItemsActivos({
      tenantId: req.usuario.tenant_id,
      soloPendientes,
    });
    return exito(res, items);
  } catch (err) { return manejarError(res, err); }
};

/**
 * GET /api/cocina/orden/:ordenId/ticket
 * Genera texto plano para imprimir comanda de cocina
 */
const getTicket = async (req, res) => {
  if (!esUuidValido(req.params.ordenId)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

  try {
    const texto = await service.getTicketTexto({
      tenantId: req.usuario.tenant_id,
      ordenId: req.params.ordenId,
    });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(texto);
  } catch (err) { return manejarError(res, err); }
};

module.exports = { listarItems, getTicket };
