import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { requiereCajaAbierta } from '../../../../shared/middlewares/caja.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.post('/ordenes/:id/transferir', requiereCajaAbierta, requierePermiso('ordenes.actualizar'), handler);
export default router;
