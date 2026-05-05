// src/modules/clientes/clientes.controller.js
// Orquesta los requests HTTP del módulo de clientes
// Principio S (SOLID): solo recibe, valida y responde — no opera datos

const service = require('./clientes.service');
const {
  crearClienteSchema,
  actualizarClienteSchema,
  filtrosClientesSchema,
} = require('./clientes.schema');
const {
  exito,
  creado,
  error,
  errorServidor,
} = require('../../utils/response');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────
// Helper: manejo de errores del service
// ─────────────────────────────────────────────
const manejarError = (res, err) => {
  if (err.status && err.mensaje) {
    return error(res, err.mensaje, err.status);
  }
  if (err.code === '23505') {
    return error(res, 'Ya existe un cliente con ese NIT o NRC.', 409);
  }
  logger.error('Error no controlado en clientes', {
    error: err.message,
    stack: err.stack,
  });
  return errorServidor(res);
};

// ─────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────

/**
 * GET /api/clientes
 * Lista clientes con filtros y paginación
 */
const listarClientes = async (req, res) => {
  const paginaRaw = req.query.pagina ? Number(req.query.pagina) : 1;
  const limiteRaw = req.query.limite ? Number(req.query.limite) : 20;

  if (req.query.pagina && (!Number.isInteger(paginaRaw) || paginaRaw < 1)) {
    return error(res, 'El parámetro pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limiteRaw) || limiteRaw < 1)) {
    return error(res, 'El parámetro limite debe ser un número entero positivo.', 400);
  }

  const { error: validacionError, value: filtros } = filtrosClientesSchema.validate({
    ...req.query,
    activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined,
    pagina: paginaRaw,
    limite: limiteRaw,
  });

  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await service.listarClientes({
      tenantId: req.usuario.tenant_id,
      filtros,
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/clientes/buscar?q=texto
 * Búsqueda rápida para el POS al momento de facturar
 * Devuelve máximo 10 resultados optimizados para selección rápida
 */
const buscarClientes = async (req, res) => {
  const { q } = req.query;

  try {
    const clientes = await service.buscarClientes({
      tenantId: req.usuario.tenant_id,
      q,
    });
    return exito(res, clientes);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/clientes/:id
 * Detalle completo de un cliente
 */
const obtenerCliente = async (req, res) => {
  try {
    const cliente = await service.obtenerCliente({
      tenantId:  req.usuario.tenant_id,
      clienteId: req.params.id,
    });
    return exito(res, cliente);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * POST /api/clientes
 * Crea un nuevo cliente
 */
const crearCliente = async (req, res) => {
  const { error: validacionError, value } = crearClienteSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const cliente = await service.crearCliente({
      tenantId: req.usuario.tenant_id,
      datos:    value,
    });
    return creado(res, cliente, 'Cliente creado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/clientes/:id
 * Actualiza datos de un cliente
 */
const actualizarCliente = async (req, res) => {
  const { error: validacionError, value } = actualizarClienteSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const cliente = await service.actualizarCliente({
      tenantId:  req.usuario.tenant_id,
      clienteId: req.params.id,
      datos:     value,
    });
    return exito(res, cliente, 'Cliente actualizado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * DELETE /api/clientes/:id
 * Desactiva un cliente (soft delete)
 */
const desactivarCliente = async (req, res) => {
  try {
    await service.desactivarCliente({
      tenantId:  req.usuario.tenant_id,
      clienteId: req.params.id,
    });
    return exito(res, null, 'Cliente desactivado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

module.exports = {
  listarClientes,
  buscarClientes,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  desactivarCliente,
};
