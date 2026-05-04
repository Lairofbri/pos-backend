// src/modules/auth/auth.routes.js
// Define todas las rutas del módulo de autenticación y gestión de usuarios

const { Router } = require('express');
const controller = require('./auth.controller');
const { autenticar } = require('../../middlewares/auth.middleware');
const { soloAdmin, todosLosRoles } = require('../../middlewares/role.middleware');

const router = Router();

// ─────────────────────────────────────────────
// Rutas PÚBLICAS (sin autenticación)
// ─────────────────────────────────────────────

// Login con email y password — panel web administrador
router.post('/auth/login', controller.loginEmail);

// Login con PIN — estaciones POS
// Requiere header: X-Tenant-Id
router.post('/auth/login-pin', controller.loginPin);

// Renovar access token
router.post('/auth/refresh', controller.refresh);

// Lista de usuarios para pantalla de selección de PIN en la estación
// No devuelve datos sensibles, solo nombre + id
// Requiere header: X-Tenant-Id
router.get('/usuarios/pin-list', controller.listarUsuariosParaPin);

// ─────────────────────────────────────────────
// Rutas PROTEGIDAS (requieren JWT válido)
// ─────────────────────────────────────────────

// Cerrar sesión
router.post('/auth/logout', autenticar, controller.logout);

// Datos del usuario actual
router.get('/auth/me', autenticar, controller.me);

// Cambiar PIN propio (cualquier rol)
router.put('/auth/cambiar-pin', autenticar, todosLosRoles, controller.cambiarPin);

// Cambiar password propio (solo admin — solo ellos tienen password web)
router.put('/auth/cambiar-password', autenticar, soloAdmin, controller.cambiarPassword);

// ─────────────────────────────────────────────
// Gestión de usuarios — solo administrador
// ─────────────────────────────────────────────

// Listar todos los usuarios del restaurante
router.get('/usuarios', autenticar, soloAdmin, controller.listarUsuarios);

// Obtener un usuario específico
router.get('/usuarios/:id', autenticar, soloAdmin, controller.obtenerUsuario);

// Crear nuevo usuario (cajero, mesero, etc.)
router.post('/usuarios', autenticar, soloAdmin, controller.crearUsuario);

// Actualizar datos de un usuario
router.patch('/usuarios/:id', autenticar, soloAdmin, controller.actualizarUsuario);

// Resetear PIN de un usuario (admin puede resetear el PIN de cualquiera)
router.post('/usuarios/:id/resetear-pin', autenticar, soloAdmin, controller.resetearPin);

module.exports = router;
