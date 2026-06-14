// src/modules/clientes/clientes.routes.js
// Define todas las rutas del módulo de clientes
// Principio S (SOLID): solo enruta, no valida ni opera

const { Router } = require('express');
const controller  = require('./clientes.controller');
const { autenticar }         = require('../../middlewares/auth.middleware');
const { requierePermiso }    = require('../../middlewares/permisos.middleware');

const router = Router();

// Todas las rutas requieren autenticación
router.use(autenticar);

// ─────────────────────────────────────────────
// IMPORTANTE: rutas específicas ANTES de /:id
// para que Express no confunda 'buscar' con un UUID
// ─────────────────────────────────────────────

router.get('/clientes/buscar', requierePermiso('clientes.ver'), controller.buscarClientes);
router.get('/clientes', requierePermiso('clientes.ver'), controller.listarClientes);
router.get('/clientes/:id', requierePermiso('clientes.ver'), controller.obtenerCliente);
router.post('/clientes', requierePermiso('clientes.crear'), controller.crearCliente);
router.patch('/clientes/:id', requierePermiso('clientes.editar'), controller.actualizarCliente);
router.delete('/clientes/:id', requierePermiso('clientes.desactivar'), controller.desactivarCliente);

module.exports = router;
