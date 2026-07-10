import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import { requierePermiso } from '../../shared/middlewares/permisos.middleware.js';
import empresasListar from './empresas/listar/endpoint.js';
import loginEmail from './email/endpoint.js';
import loginPin from './pin/endpoint.js';
import refreshEndpoint from './refresh/endpoint.js';
import logoutEndpoint from './logout/endpoint.js';
import meEndpoint from './me/endpoint.js';
import cambiarPinEndpoint from './cambiar-pin/endpoint.js';
import pinListEndpoint from './pin-list/endpoint.js';
import usuariosListar from './usuarios/listar/endpoint.js';
import usuariosObtener from './usuarios/obtener/endpoint.js';
import usuariosCrear from './usuarios/crear/endpoint.js';
import usuariosActualizar from './usuarios/actualizar/endpoint.js';
import usuariosResetearPin from './usuarios/resetear-pin/endpoint.js';

const router = Router({ mergeParams: true });

router.use(empresasListar);
router.use(loginEmail);
router.use(loginPin);
router.use(refreshEndpoint);
router.use(pinListEndpoint);

router.use(autenticar);
router.use(logoutEndpoint);
router.use(meEndpoint);
router.use(cambiarPinEndpoint);
router.use(usuariosListar);
router.use(usuariosObtener);
router.use(usuariosCrear);
router.use(usuariosActualizar);
router.use(usuariosResetearPin);

import { handler as cambiarPasswordHandler } from './cambiar-password/handler.js';
router.put('/auth/cambiar-password', autenticar, requierePermiso('usuarios.editar'), cambiarPasswordHandler);

export default router;
