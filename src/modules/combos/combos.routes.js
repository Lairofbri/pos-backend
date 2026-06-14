// src/modules/combos/combos.routes.js
// Define todas las rutas del módulo de combos

const { Router } = require('express');
const controller = require('./combos.controller');
const { autenticar } = require('../../middlewares/auth.middleware');
const { requierePermiso } = require('../../middlewares/permisos.middleware');

const router = Router();

router.use(autenticar);

router.get('/combos', requierePermiso('combos.ver'), controller.listarCombos);
router.get('/combos/:id', requierePermiso('combos.ver'), controller.obtenerCombo);
router.post('/combos', requierePermiso('combos.crear'), controller.crearCombo);
router.patch('/combos/:id', requierePermiso('combos.editar'), controller.actualizarCombo);
router.delete('/combos/:id', requierePermiso('combos.desactivar'), controller.desactivarCombo);

module.exports = router;
