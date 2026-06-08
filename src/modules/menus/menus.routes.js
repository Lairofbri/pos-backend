// src/modules/menus/menus.routes.js
// Ruta del menú dinámico del sidebar

const { Router } = require('express');
const controller = require('./menus.controller');
const { autenticar } = require('../../middlewares/auth.middleware');

const router = Router();

router.use(autenticar);

router.get('/menus', controller.listarMenus);

module.exports = router;
