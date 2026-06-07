// src/modules/permisos/permisos.routes.js
// Define todas las rutas del módulo de permisos
// Principio S (SOLID): solo enruta, no valida ni opera

const { Router } = require('express');
const controller = require('./permisos.controller');
const { autenticar } = require('../../middlewares/auth.middleware');
const { requierePermiso } = require('../../middlewares/permisos.middleware');

const router = Router();

// Todas las rutas requieren autenticación y permiso de configuración de roles
router.use(autenticar);
router.use(requierePermiso('roles.configurar'));

// Catálogo completo de permisos
router.get('/permisos', controller.listarCatalogo);

// Permisos de un rol específico en el tenant
router.get('/permisos/rol/:rol', controller.obtenerPermisosRol);

// Actualizar permisos de un rol
router.put('/permisos/rol/:rol', controller.actualizarPermisosRol);

// Lista de roles disponibles
router.get('/permisos/roles', controller.listarRoles);

// Resetear permisos de un rol a defaults
router.post('/permisos/rol/:rol/reset', controller.resetearPermisosRol);

module.exports = router;
