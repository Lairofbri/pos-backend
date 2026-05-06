// src/modules/caja/caja.routes.js
// Define todas las rutas del módulo de caja
// Principio S (SOLID): solo enruta, no valida ni opera

const { Router } = require('express');
const controller  = require('./caja.controller');
const { autenticar }                    = require('../../middlewares/auth.middleware');
const { soloAdmin, adminOCajero, todosLosRoles } = require('../../middlewares/role.middleware');

const router = Router();

// Todas las rutas requieren autenticación
router.use(autenticar);

// ─────────────────────────────────────────────
// IMPORTANTE: rutas específicas ANTES de /:id
// ─────────────────────────────────────────────

// Historial de cajas — solo admin
router.get('/caja/historial', soloAdmin, controller.getHistorialCajas);

// Caja activa — todos los roles (el mesero puede consultar)
router.get('/caja/activa', todosLosRoles, controller.getCajaActiva);

// Abrir caja — admin y cajero
router.post('/caja/abrir', adminOCajero, controller.abrirCaja);

// Cerrar caja — admin y cajero
router.post('/caja/cerrar', adminOCajero, controller.cerrarCaja);

// Registrar movimiento manual — admin y cajero
router.post('/caja/movimiento', adminOCajero, controller.registrarMovimiento);

// Movimientos de una caja específica — admin y cajero
router.get('/caja/:id/movimientos', adminOCajero, controller.getMovimientos);

module.exports = router;
