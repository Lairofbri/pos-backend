// src/modules/cocina/cocina.routes.js
// Define todas las rutas del módulo de cocina

const { Router } = require('express');
const controller = require('./cocina.controller');
const { autenticar } = require('../../middlewares/auth.middleware');
const { adminOCajero, todosLosRoles } = require('../../middlewares/role.middleware');

const router = Router();

router.use(autenticar);

// Items activos en cocina — todos los roles (mesero necesita ver estado)
router.get('/cocina', todosLosRoles, controller.listarItems);

// Ticket para impresora de cocina — admin y cajero
router.get('/cocina/orden/:ordenId/ticket', adminOCajero, controller.getTicket);

module.exports = router;
