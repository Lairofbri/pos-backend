// src/modules/catalogos/catalogos.routes.js

const { Router } = require('express');
const controller = require('./catalogos.controller');
const { autenticar } = require('../../middlewares/auth.middleware');

const router = Router();

router.get('/catalogos', autenticar, controller.listarCatalogos);

module.exports = router;
