// src/modules/menus/menus.routes.js
// Ruta del menú dinámico del sidebar

const { Router } = require('express');
const controller = require('./menus.controller');
const { autenticar } = require('../../middlewares/auth.middleware');
const { requierePermiso } = require('../../middlewares/permisos.middleware');

const router = Router();

router.use(autenticar);

router.get('/menus', controller.listarMenus);
router.get('/menus/:id', requierePermiso('menus.ver'), controller.obtenerMenu);

router.post('/menus', requierePermiso('menus.crear'), controller.crearMenu);
router.patch('/menus/:id', requierePermiso('menus.editar'), controller.actualizarMenu);
router.delete('/menus/:id', requierePermiso('menus.desactivar'), controller.desactivarMenu);

module.exports = router;
