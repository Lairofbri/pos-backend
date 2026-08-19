import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import { requierePermiso } from '../../shared/middlewares/permisos.middleware.js';
import { listarHandler, exportarHandler } from './handler.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.get('/cuentas', requierePermiso('ordenes.ver'), listarHandler);
router.get('/cuentas/exportar', requierePermiso('ordenes.ver'), exportarHandler);

export default router;
