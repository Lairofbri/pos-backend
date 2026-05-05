// src/modules/productos/productos.controller.js
// Orquesta los requests HTTP del módulo de productos
// Principio S (SOLID): solo recibe, valida y responde — no opera datos
// View en MVC: delega al service y formatea la respuesta con response.js

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
  noEncontrado,
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
  // Error de unique constraint de PostgreSQL (nombre duplicado)
  if (err.code === '23505') {
    return error(res, 'Ya existe un registro con ese nombre.', 409);
  }
  logger.error('Error no controlado en productos', {
    error: err.message,
    stack: err.stack,
  });
  return errorServidor(res);
};

// ═════════════════════════════════════════════
// CATEGORÍAS
// ═════════════════════════════════════════════

/**
 * GET /api/categorias
 * Lista todas las categorías del tenant
 * Query param: ?todas=true para incluir inactivas (solo admin)
 */
const listarCategorias = async (req, res) => {
  try {
    const soloActivas = req.query.todas !== 'true';
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
 * Obtiene una categoría por ID
 */
const obtenerCategoria = async (req, res) => {
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
 * Crea una nueva categoría
 */
const crearCategoria = async (req, res) => {
  const { error: validacionError, value } = crearCategoriaSchema.validate(req.body);
  if (validacionError) {
    return error(res, validacionError.details[0].message, 400);
  }
  try {
    const categoria = await service.crearCategoria({
      tenantId: req.usuario.tenant_id,
      datos: value,
    });
    return creado(res, categoria, 'Categoría creada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/categorias/:id
 * Actualiza una categoría existente
 */
const actualizarCategoria = async (req, res) => {
  const { error: validacionError, value } = actualizarCategoriaSchema.validate(req.body);
  if (validacionError) {
    return error(res, validacionError.details[0].message, 400);
  }
  try {
    const categoria = await service.actualizarCategoria({
      tenantId:    req.usuario.tenant_id,
      categoriaId: req.params.id,
      datos: value,
    });
    return exito(res, categoria, 'Categoría actualizada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * DELETE /api/categorias/:id
 * Desactiva una categoría (soft delete)
 */
const desactivarCategoria = async (req, res) => {
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
 * GET /api/productos
 * Lista productos con filtros opcionales
 * Query params: categoria_id, activo, busqueda, con_stock, pagina, limite
 */
const listarProductos = async (req, res) => {
  // Validar y parsear query params
  const { error: validacionError, value: filtros } = filtrosProductosSchema.validate({
    ...req.query,
    // Convertir strings a tipos correctos
    activo:    req.query.activo    !== undefined ? req.query.activo    === 'true' : undefined,
    con_stock: req.query.con_stock !== undefined ? req.query.con_stock === 'true' : undefined,
    pagina:    req.query.pagina    ? parseInt(req.query.pagina)  : 1,
    limite:    req.query.limite    ? parseInt(req.query.limite)  : 50,
  });

  if (validacionError) {
    return error(res, validacionError.details[0].message, 400);
  }

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
 * Obtiene un producto por ID
 */
const obtenerProducto = async (req, res) => {
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
 * Crea un nuevo producto
 */
const crearProducto = async (req, res) => {
  const { error: validacionError, value } = crearProductoSchema.validate(req.body);
  if (validacionError) {
    return error(res, validacionError.details[0].message, 400);
  }
  try {
    const producto = await service.crearProducto({
      tenantId: req.usuario.tenant_id,
      datos: value,
    });
    return creado(res, producto, 'Producto creado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/productos/:id
 * Actualiza un producto existente
 */
const actualizarProducto = async (req, res) => {
  const { error: validacionError, value } = actualizarProductoSchema.validate(req.body);
  if (validacionError) {
    return error(res, validacionError.details[0].message, 400);
  }
  try {
    const producto = await service.actualizarProducto({
      tenantId:   req.usuario.tenant_id,
      productoId: req.params.id,
      datos: value,
    });
    return exito(res, producto, 'Producto actualizado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

/**
 * PATCH /api/productos/:id/toggle
 * Activa o desactiva un producto rápidamente desde el POS
 */
const toggleProducto = async (req, res) => {
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
 * Desactiva un producto (soft delete)
 */
const desactivarProducto = async (req, res) => {
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
 * Ajusta el stock de un producto
 */
const ajustarStock = async (req, res) => {
  const { error: validacionError, value } = ajustarStockSchema.validate(req.body);
  if (validacionError) {
    return error(res, validacionError.details[0].message, 400);
  }
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

/**
 * GET /api/productos/alertas/stock-bajo
 * Productos con stock por debajo del mínimo
 * Para el panel admin en tiempo real
 */
const stockBajo = async (req, res) => {
  try {
    const productos = await service.productosStockBajo({
      tenantId: req.usuario.tenant_id,
    });
    return exito(res, productos);
  } catch (err) {
    return manejarError(res, err);
  }
};

module.exports = {
  // Categorías
  listarCategorias,
  obtenerCategoria,
  crearCategoria,
  actualizarCategoria,
  desactivarCategoria,
  // Productos
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  toggleProducto,
  desactivarProducto,
  ajustarStock,
  stockBajo,
};
