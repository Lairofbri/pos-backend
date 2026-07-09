import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { requiereCajaAbierta } from '../../../../shared/middlewares/caja.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.delete('/ordenes/:id/items/:itemId', requiereCajaAbierta, requierePermiso('items.eliminar'), handler);
export default router;
