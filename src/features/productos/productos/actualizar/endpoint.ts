import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.patch('/productos/:id', validarUuidParam('id', 'producto'), requierePermiso('productos.editar'), handler);
export default router;
