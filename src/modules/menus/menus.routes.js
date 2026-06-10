// src/modules/menus/menus.routes.js
// Ruta del menú dinámico del sidebar

const { Router } = require('express');
const controller = require('./menus.controller');
const { autenticar } = require('../../middlewares/auth.middleware');
const { soloAdmin } = require('../../middlewares/role.middleware');

const router = Router();

router.use(autenticar);

router.get('/menus', controller.listarMenus);
router.get('/menus/:id', controller.obtenerMenu);

router.post('/menus', soloAdmin, controller.crearMenu);
router.patch('/menus/:id', soloAdmin, controller.actualizarMenu);
router.delete('/menus/:id', soloAdmin, controller.desactivarMenu);

module.exports = router;
