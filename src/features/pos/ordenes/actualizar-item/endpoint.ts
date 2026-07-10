import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { requiereCajaAbierta } from '../../../../shared/middlewares/caja.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.patch('/ordenes/:id/items/:itemId', requiereCajaAbierta, requierePermiso('items.estado'), handler);
export default router;
