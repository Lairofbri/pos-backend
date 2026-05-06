// src/modules/productos/productos.controller.js
// Orquesta los requests HTTP del módulo de productos
// Principio S (SOLID): solo recibe, valida y responde — no opera datos

const service = require('./productos.service');
const {
  crearCategoriaSchema,
  actualizarCategoriaSchema,
  crearProductoSchema,
  actualizarProductoSchema,
  ajustarStockSchema,
  filtrosProductosSchema,
} = require('./productos.schema');
const {
  exito,
  creado,
  error,
  errorServidor,
} = require('../../utils/response');
const { esUuidValido } = require('../../middlewares/uuid.middleware');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────
// Helper: manejo de errores del service
// ─────────────────────────────────────────────
const manejarError = (res, err) => {
  if (err.status && err.mensaje) {
    return error(res, err.mensaje, err.status);
  }
  if (err.code === '23505') {
    return error(res, 'Ya existe un registro con ese nombre.', 409);
  }
  logger.error('Error no controlado en productos', { error: err.message, stack: err.stack });
  return errorServidor(res);
};

// ═════════════════════════════════════════════
// CATEGORÍAS
// ═════════════════════════════════════════════

/**
 * GET /api/categorias
 * Fix CUBIC: solo admin puede ver inactivas — verificado en código, no solo en comentario
 */
const listarCategorias = async (req, res) => {
  try {
    const esAdmin     = req.usuario.rol === 'administrador';
    const soloActivas = !esAdmin || req.query.todas !== 'true';

    const categorias = await service.listarCategorias({
      tenantId: req.usuario.tenant_id,
      soloActivas,
    });
    return exito(res, categorias);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/categorias/:id
 * Fix CUBIC: valida UUID antes de consultar
 */
const obtenerCategoria = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de categoría no tiene un formato UUID válido.', 400);
  }

  try {
    const categoria = await service.obtenerCategoria({
      tenantId:    req.usuario.tenant_id,
      categoriaId: req.params.id,
    });
    return exito(res, categoria);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * POST /api/categorias
 */
const crearCategoria = async (req, res) => {
  const { error: validacionError, value } = crearCategoriaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const categoria = await service.crearCategoria({
      tenantId: req.usuario.tenant_id,
      datos:    value,
    });
    return creado(res, categoria, 'Categoría creada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/categorias/:id
 * Fix CUBIC: valida UUID antes de actualizar
 */
const actualizarCategoria = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de categoría no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = actualizarCategoriaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const categoria = await service.actualizarCategoria({
      tenantId:    req.usuario.tenant_id,
      categoriaId: req.params.id,
      datos:       value,
    });
    return exito(res, categoria, 'Categoría actualizada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * DELETE /api/categorias/:id
 * Fix CUBIC: valida UUID antes de desactivar
 */
const desactivarCategoria = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de categoría no tiene un formato UUID válido.', 400);
  }

  try {
    await service.desactivarCategoria({
      tenantId:    req.usuario.tenant_id,
      categoriaId: req.params.id,
    });
    return exito(res, null, 'Categoría desactivada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

// ═════════════════════════════════════════════
// PRODUCTOS
// ═════════════════════════════════════════════

/**
 * GET /api/productos/alertas/stock-bajo
 */
const stockBajo = async (req, res) => {
  try {
    const productos = await service.productosStockBajo({ tenantId: req.usuario.tenant_id });
    return exito(res, productos);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/productos
 * Fix CUBIC: Number() + isInteger() en lugar de parseInt
 */
const listarProductos = async (req, res) => {
  const paginaRaw = req.query.pagina ? Number(req.query.pagina) : 1;
  const limiteRaw = req.query.limite ? Number(req.query.limite) : 50;

  if (req.query.pagina && (!Number.isInteger(paginaRaw) || paginaRaw < 1)) {
    return error(res, 'El parámetro pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limiteRaw) || limiteRaw < 1)) {
    return error(res, 'El parámetro limite debe ser un número entero positivo.', 400);
  }

  // Fix CUBIC: validar categoria_id si se provee
  if (req.query.categoria_id && !esUuidValido(req.query.categoria_id)) {
    return error(res, 'El parámetro categoria_id no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value: filtros } = filtrosProductosSchema.validate({
    ...req.query,
    activo:    req.query.activo    !== undefined ? req.query.activo    === 'true' : undefined,
    con_stock: req.query.con_stock !== undefined ? req.query.con_stock === 'true' : undefined,
    pagina:    paginaRaw,
    limite:    limiteRaw,
  });

  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await service.listarProductos({
      tenantId: req.usuario.tenant_id,
      filtros,
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * GET /api/productos/:id
 * Fix CUBIC: valida UUID antes de consultar
 */
const obtenerProducto = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de producto no tiene un formato UUID válido.', 400);
  }

  try {
    const producto = await service.obtenerProducto({
      tenantId:   req.usuario.tenant_id,
      productoId: req.params.id,
    });
    return exito(res, producto);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * POST /api/productos
 */
const crearProducto = async (req, res) => {
  const { error: validacionError, value } = crearProductoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const producto = await service.crearProducto({
      tenantId: req.usuario.tenant_id,
      datos:    value,
    });
    return creado(res, producto, 'Producto creado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/productos/:id
 * Fix CUBIC: valida UUID antes de actualizar
 */
const actualizarProducto = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de producto no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = actualizarProductoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const producto = await service.actualizarProducto({
      tenantId:   req.usuario.tenant_id,
      productoId: req.params.id,
      datos:      value,
    });
    return exito(res, producto, 'Producto actualizado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/productos/:id/toggle
 * Fix CUBIC: valida UUID antes de toggle
 */
const toggleProducto = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de producto no tiene un formato UUID válido.', 400);
  }

  try {
    const resultado = await service.toggleProducto({
      tenantId:   req.usuario.tenant_id,
      productoId: req.params.id,
    });
    const msg = resultado.activo ? 'Producto activado.' : 'Producto desactivado.';
    return exito(res, resultado, msg);
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * DELETE /api/productos/:id
 * Fix CUBIC: valida UUID antes de desactivar
 */
const desactivarProducto = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de producto no tiene un formato UUID válido.', 400);
  }

  try {
    await service.desactivarProducto({
      tenantId:   req.usuario.tenant_id,
      productoId: req.params.id,
    });
    return exito(res, null, 'Producto desactivado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/productos/:id/stock
 * Fix CUBIC: valida UUID + cantidad no negativa (ya en schema)
 */
const ajustarStock = async (req, res) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de producto no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = ajustarStockSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const producto = await service.ajustarStock({
      tenantId:   req.usuario.tenant_id,
      productoId: req.params.id,
      cantidad:   value.cantidad,
      tipo:       value.tipo,
      motivo:     value.motivo,
    });
    return exito(res, producto, 'Stock ajustado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

module.exports = {
  listarCategorias,
  obtenerCategoria,
  crearCategoria,
  actualizarCategoria,
  desactivarCategoria,
  stockBajo,
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  toggleProducto,
  desactivarProducto,
  ajustarStock,
};
