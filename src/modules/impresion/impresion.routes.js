// src/modules/impresion/impresion.routes.js
// Define todas las rutas del módulo de impresión térmica

const { Router } = require('express');
const controller = require('./impresion.controller');
const { autenticar } = require('../../middlewares/auth.middleware');
const { requierePermiso } = require('../../middlewares/permisos.middleware');

const router = Router();

router.use(autenticar);

router.get('/impresion', requierePermiso('impresion.configurar'), controller.listar);
router.post('/impresion', requierePermiso('impresion.configurar'), controller.crear);
router.put('/impresion/:id', requierePermiso('impresion.configurar'), controller.actualizar);
router.delete('/impresion/:id', requierePermiso('impresion.configurar'), controller.eliminar);

router.post('/impresion/test', requierePermiso('impresion.configurar'), controller.imprimirPrueba);
router.post('/impresion/print/:ordenId', requierePermiso('ordenes.ver'), controller.imprimir);

module.exports = router;
