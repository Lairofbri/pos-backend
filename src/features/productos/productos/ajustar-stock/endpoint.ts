import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.patch('/productos/:id/stock', validarUuidParam('id', 'producto'), requierePermiso('productos.stock'), handler);
export default router;
