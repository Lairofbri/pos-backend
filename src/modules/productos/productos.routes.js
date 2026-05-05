// src/modules/productos/productos.routes.js
// Define todas las rutas del módulo de productos y categorías
// Principio S (SOLID): solo enruta, no valida ni opera

const { Router } = require('express');
const controller  = require('./productos.controller');
const { autenticar }                    = require('../../middlewares/auth.middleware');
const { soloAdmin, adminOCajero, todosLosRoles } = require('../../middlewares/role.middleware');

const router = Router();

// Todas las rutas de este módulo requieren autenticación
router.use(autenticar);

// ─────────────────────────────────────────────
// CATEGORÍAS
// ─────────────────────────────────────────────

// Listar categorías — todos los roles (el POS las necesita)
router.get('/categorias', todosLosRoles, controller.listarCategorias);

// Obtener una categoría — todos los roles
router.get('/categorias/:id', todosLosRoles, controller.obtenerCategoria);

// Crear categoría — solo admin
router.post('/categorias', soloAdmin, controller.crearCategoria);

// Actualizar categoría — solo admin
router.patch('/categorias/:id', soloAdmin, controller.actualizarCategoria);

// Desactivar categoría — solo admin
router.delete('/categorias/:id', soloAdmin, controller.desactivarCategoria);

// ─────────────────────────────────────────────
// PRODUCTOS
// ─────────────────────────────────────────────

// Alertas de stock bajo — admin y cajero
// IMPORTANTE: esta ruta va ANTES de /:id para que no confunda
// 'alertas' con un UUID
router.get('/productos/alertas/stock-bajo', adminOCajero, controller.stockBajo);

// Listar productos con filtros — todos los roles
router.get('/productos', todosLosRoles, controller.listarProductos);

// Obtener un producto — todos los roles
router.get('/productos/:id', todosLosRoles, controller.obtenerProducto);

// Crear producto — solo admin
router.post('/productos', soloAdmin, controller.crearProducto);

// Actualizar producto — solo admin
router.patch('/productos/:id', soloAdmin, controller.actualizarProducto);

// Toggle activo/inactivo — admin y cajero (para marcar agotado desde el POS)
router.patch('/productos/:id/toggle', adminOCajero, controller.toggleProducto);

// Ajustar stock — admin y cajero
router.patch('/productos/:id/stock', adminOCajero, controller.ajustarStock);

// Desactivar producto — solo admin
router.delete('/productos/:id', soloAdmin, controller.desactivarProducto);

module.exports = router;
