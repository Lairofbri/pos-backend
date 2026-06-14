// src/modules/productos/productos.routes.js
// Define todas las rutas del módulo de productos y categorías
// Principio S (SOLID): solo enruta, no valida ni opera

const { Router } = require('express');
const controller  = require('./productos.controller');
const { autenticar }         = require('../../middlewares/auth.middleware');
const { requierePermiso }    = require('../../middlewares/permisos.middleware');

const router = Router();

// Todas las rutas de este módulo requieren autenticación
router.use(autenticar);

// ─────────────────────────────────────────────
// CATEGORÍAS
// ─────────────────────────────────────────────

router.get('/categorias', requierePermiso('categorias.ver'), controller.listarCategorias);
router.get('/categorias/:id', requierePermiso('categorias.ver'), controller.obtenerCategoria);
router.post('/categorias', requierePermiso('categorias.crear'), controller.crearCategoria);
router.patch('/categorias/:id', requierePermiso('categorias.editar'), controller.actualizarCategoria);
router.delete('/categorias/:id', requierePermiso('categorias.desactivar'), controller.desactivarCategoria);

// ─────────────────────────────────────────────
// PRODUCTOS
// ─────────────────────────────────────────────

// IMPORTANTE: alertas va ANTES de /:id
router.get('/productos/alertas/stock-bajo', requierePermiso('productos.stock'), controller.stockBajo);

router.get('/productos', requierePermiso('productos.ver'), controller.listarProductos);
router.get('/productos/:id', requierePermiso('productos.ver'), controller.obtenerProducto);
router.post('/productos', requierePermiso('productos.crear'), controller.crearProducto);
router.patch('/productos/:id', requierePermiso('productos.editar'), controller.actualizarProducto);
router.patch('/productos/:id/toggle', requierePermiso('productos.desactivar'), controller.toggleProducto);
router.patch('/productos/:id/stock', requierePermiso('productos.stock'), controller.ajustarStock);
router.delete('/productos/:id', requierePermiso('productos.desactivar'), controller.desactivarProducto);

module.exports = router;
