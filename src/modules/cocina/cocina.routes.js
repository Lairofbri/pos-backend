// src/modules/cocina/cocina.routes.js
// Define todas las rutas del módulo de cocina

const { Router } = require('express');
const controller = require('./cocina.controller');
const { autenticar } = require('../../middlewares/auth.middleware');
const { requierePermiso } = require('../../middlewares/permisos.middleware');

const router = Router();

router.use(autenticar);

router.get('/cocina', requierePermiso('items.estado'), controller.listarItems);
router.get('/cocina/orden/:ordenId/ticket', requierePermiso('items.estado'), controller.getTicket);

module.exports = router;
