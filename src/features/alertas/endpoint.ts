import { Router } from 'express';
import { requierePermiso } from '../../shared/middlewares/permisos.middleware.js';
import {
  handler,
  resolverHandler,
  historialHandler,
  configGetHandler,
  configPutHandler,
} from './handler.js';

const router = Router({ mergeParams: true });
router.get('/alertas', requierePermiso('alertas.ver'), handler);
router.post('/alertas/:alertaId/resolver', requierePermiso('alertas.ver'), resolverHandler);
router.get('/alertas/historial', requierePermiso('alertas.ver'), historialHandler);
router.get('/alertas/config', requierePermiso('alertas.ver'), configGetHandler);
router.put('/alertas/config', requierePermiso('alertas.configurar'), configPutHandler);
export default router;