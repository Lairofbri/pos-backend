// src/modules/pos/pos.routes.js
// Define todas las rutas del módulo POS
// Principio S (SOLID): solo enruta, no valida ni opera

const { Router } = require('express');
const controller  = require('./pos.controller');
const { autenticar }                             = require('../../middlewares/auth.middleware');
const { soloAdmin, adminOCajero, todosLosRoles } = require('../../middlewares/role.middleware');

const router = Router();

// Todas las rutas requieren autenticación
router.use(autenticar);

// ─────────────────────────────────────────────
// MESAS
// ─────────────────────────────────────────────

// Listar mesas — todos los roles (el POS las necesita)
router.get('/mesas', todosLosRoles, controller.listarMesas);

// Obtener una mesa — todos los roles
router.get('/mesas/:id', todosLosRoles, controller.obtenerMesa);

// Crear mesa — solo admin
router.post('/mesas', soloAdmin, controller.crearMesa);

// Actualizar mesa — solo admin
router.patch('/mesas/:id', soloAdmin, controller.actualizarMesa);

// ─────────────────────────────────────────────
// ÓRDENES
// ─────────────────────────────────────────────

// Listar órdenes — admin y cajero
router.get('/ordenes', adminOCajero, controller.listarOrdenes);

// Obtener detalle de orden — todos los roles
router.get('/ordenes/:id', todosLosRoles, controller.obtenerOrden);

// Crear orden — admin y cajero
router.post('/ordenes', adminOCajero, controller.crearOrden);

// Actualizar notas/descuento de orden — admin y cajero
router.patch('/ordenes/:id', adminOCajero, controller.actualizarOrden);

// Cambiar estado de orden — todos los roles
// (el mesero puede marcar "lista", el cajero "pagada", etc.)
router.patch('/ordenes/:id/estado', todosLosRoles, controller.cambiarEstadoOrden);

// ─────────────────────────────────────────────
// ITEMS DE ORDEN
// ─────────────────────────────────────────────

// Agregar item — admin y cajero
router.post('/ordenes/:id/items', adminOCajero, controller.agregarItem);

// Actualizar item — todos los roles (mesero puede actualizar estado desde cocina)
router.patch('/ordenes/:id/items/:itemId', todosLosRoles, controller.actualizarItem);

// Eliminar item — admin y cajero
router.delete('/ordenes/:id/items/:itemId', adminOCajero, controller.eliminarItem);

// ─────────────────────────────────────────────
// PAGOS
// ─────────────────────────────────────────────

// Registrar pago — admin y cajero
router.post('/ordenes/:id/pagar', adminOCajero, controller.registrarPago);

module.exports = router;
