import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { requiereCajaAbierta } from '../../../../shared/middlewares/caja.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.post('/ordenes/:id/items', requiereCajaAbierta, requierePermiso('items.agregar'), handler);
export default router;
