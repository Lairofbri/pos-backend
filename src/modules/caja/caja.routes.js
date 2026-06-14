// src/modules/caja/caja.routes.js
// Define todas las rutas del módulo de caja
// Principio S (SOLID): solo enruta, no valida ni opera

const { Router } = require('express');
const controller  = require('./caja.controller');
const { autenticar }         = require('../../middlewares/auth.middleware');
const { requierePermiso }    = require('../../middlewares/permisos.middleware');
const { requiereCajaAbierta } = require('../../middlewares/caja.middleware');

const router = Router();

// Todas las rutas requieren autenticación
router.use(autenticar);

// ─────────────────────────────────────────────
// IMPORTANTE: rutas específicas ANTES de /:id
// ─────────────────────────────────────────────

router.get('/caja/historial', requierePermiso('caja.historial'), controller.getHistorialCajas);
router.get('/caja/activa', controller.getCajaActiva);
router.post('/caja/abrir', requierePermiso('caja.abrir'), controller.abrirCaja);
router.post('/caja/cerrar', requiereCajaAbierta, requierePermiso('caja.cerrar'), controller.cerrarCaja);
router.post('/caja/movimiento', requiereCajaAbierta, requierePermiso('caja.movimientos'), controller.registrarMovimiento);
router.get('/caja/resumen-diario', requierePermiso('caja.movimientos'), controller.getResumenDiario);
router.get('/caja/:id/movimientos', requierePermiso('caja.movimientos'), controller.getMovimientos);

module.exports = router;
