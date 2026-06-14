// src/modules/catalogos/catalogos.controller.js

const service = require('./catalogos.service');
const { exito, error, errorServidor } = require('../../utils/response');
const logger = require('../../utils/logger');

const manejarError = (res, err) => {
  if (err.status && err.mensaje) return error(res, err.mensaje, err.status);
  logger.error('Error en cat\u00e1logos', { error: err.message });
  return errorServidor(res);
};

const listarCatalogos = async (req, res) => {
  try {
    const catalogos = await service.obtenerCatalogos({
      tenantId: req.usuario.tenant_id,
    });
    return exito(res, catalogos);
  } catch (err) { return manejarError(res, err); }
};

module.exports = { listarCatalogos };
