// src/modules/pos/pos.routes.js
// Define todas las rutas del módulo POS
// Principio S (SOLID): solo enruta, no valida ni opera

const { Router } = require('express');
const controller  = require('./pos.controller');
const { autenticar }                    = require('../../middlewares/auth.middleware');
const { requierePermiso }               = require('../../middlewares/permisos.middleware');
const { requiereCajaAbierta }           = require('../../middlewares/caja.middleware');

const router = Router();

// Todas las rutas requieren autenticación
router.use(autenticar);

// ─────────────────────────────────────────────
// MESAS
// ─────────────────────────────────────────────

router.get('/mesas', requierePermiso('mesas.administrar'), controller.listarMesas);
router.get('/mesas/:id', requierePermiso('mesas.administrar'), controller.obtenerMesa);
router.post('/mesas', requiereCajaAbierta, requierePermiso('mesas.administrar'), controller.crearMesa);
router.patch('/mesas/:id', requiereCajaAbierta, requierePermiso('mesas.administrar'), controller.actualizarMesa);

// ─────────────────────────────────────────────
// ÓRDENES
// ─────────────────────────────────────────────

router.get('/ordenes', requierePermiso('ordenes.ver'), controller.listarOrdenes);
router.get('/ordenes/:id', requierePermiso('ordenes.ver'), controller.obtenerOrden);
router.post('/ordenes', requiereCajaAbierta, requierePermiso('ordenes.crear'), controller.crearOrden);
router.patch('/ordenes/:id', requiereCajaAbierta, requierePermiso('ordenes.actualizar'), controller.actualizarOrden);
router.patch('/ordenes/:id/estado', requiereCajaAbierta, requierePermiso('ordenes.actualizar'), controller.cambiarEstadoOrden);

// ─────────────────────────────────────────────
// ITEMS DE ORDEN
// ─────────────────────────────────────────────

router.post('/ordenes/:id/items', requiereCajaAbierta, requierePermiso('items.agregar'), controller.agregarItem);
router.patch('/ordenes/:id/items/:itemId', requiereCajaAbierta, requierePermiso('items.estado'), controller.actualizarItem);
router.delete('/ordenes/:id/items/:itemId', requiereCajaAbierta, requierePermiso('items.eliminar'), controller.eliminarItem);

// ─────────────────────────────────────────────
// DIVIDIR CUENTA Y TRANSFERIR ITEMS
// ─────────────────────────────────────────────

router.post('/ordenes/:id/split', requiereCajaAbierta, requierePermiso('ordenes.actualizar'), controller.splitOrden);
router.post('/ordenes/:id/transferir', requiereCajaAbierta, requierePermiso('ordenes.actualizar'), controller.transferirItems);
router.patch('/ordenes/:id/cambiar-mesa', requiereCajaAbierta, requierePermiso('mesas.administrar'), controller.cambiarMesa);

// ─────────────────────────────────────────────
// PAGOS
// ─────────────────────────────────────────────

router.post('/ordenes/:id/pagar', requiereCajaAbierta, requierePermiso('pago.registrar'), controller.registrarPago);

module.exports = router;
