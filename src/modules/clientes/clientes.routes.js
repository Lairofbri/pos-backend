// src/modules/clientes/clientes.routes.js
// Define todas las rutas del módulo de clientes
// Principio S (SOLID): solo enruta, no valida ni opera

const { Router } = require('express');
const controller  = require('./clientes.controller');
const { autenticar }                             = require('../../middlewares/auth.middleware');
const { soloAdmin, adminOCajero, todosLosRoles } = require('../../middlewares/role.middleware');

const router = Router();

// Todas las rutas requieren autenticación
router.use(autenticar);

// ─────────────────────────────────────────────
// IMPORTANTE: rutas específicas ANTES de /:id
// para que Express no confunda 'buscar' con un UUID
// ─────────────────────────────────────────────

// Búsqueda rápida para el POS — todos los roles
// GET /api/clientes/buscar?q=texto
router.get('/clientes/buscar', todosLosRoles, controller.buscarClientes);

// Listar clientes con filtros — admin y cajero
router.get('/clientes', adminOCajero, controller.listarClientes);

// Obtener cliente por ID — todos los roles
router.get('/clientes/:id', todosLosRoles, controller.obtenerCliente);

// Crear cliente — admin y cajero
router.post('/clientes', adminOCajero, controller.crearCliente);

// Actualizar cliente — admin y cajero
router.patch('/clientes/:id', adminOCajero, controller.actualizarCliente);

// Desactivar cliente — solo admin
router.delete('/clientes/:id', soloAdmin, controller.desactivarCliente);

module.exports = router;
