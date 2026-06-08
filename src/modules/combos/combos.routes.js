// src/modules/combos/combos.routes.js
// Define todas las rutas del módulo de combos

const { Router } = require('express');
const controller = require('./combos.controller');
const { autenticar } = require('../../middlewares/auth.middleware');
const { soloAdmin, adminOCajero, todosLosRoles } = require('../../middlewares/role.middleware');

const router = Router();

router.use(autenticar);

// Listar combos — todos los roles
router.get('/combos', todosLosRoles, controller.listarCombos);

// Obtener combo — todos los roles
router.get('/combos/:id', todosLosRoles, controller.obtenerCombo);

// Crear combo — solo admin
router.post('/combos', soloAdmin, controller.crearCombo);

// Actualizar combo — solo admin
router.patch('/combos/:id', soloAdmin, controller.actualizarCombo);

// Desactivar combo — solo admin
router.delete('/combos/:id', soloAdmin, controller.desactivarCombo);

module.exports = router;
