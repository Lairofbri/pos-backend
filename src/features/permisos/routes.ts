import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import { requierePermiso } from '../../shared/middlewares/permisos.middleware.js';
import catalogoEndpoint from './catalogo/endpoint.js';
import rolesListarEndpoint from './roles-listar/endpoint.js';
import rolObtenerEndpoint from './rol-obtener/endpoint.js';
import rolActualizarEndpoint from './rol-actualizar/endpoint.js';
import rolResetEndpoint from './rol-reset/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(requierePermiso('roles.configurar'));
router.use(catalogoEndpoint);
router.use(rolesListarEndpoint);
router.use(rolObtenerEndpoint);
router.use(rolActualizarEndpoint);
router.use(rolResetEndpoint);

export default router;
