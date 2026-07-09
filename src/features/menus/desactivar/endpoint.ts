import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.delete('/menus/:id', validarUuidParam('id', 'menú'), requierePermiso('menus.desactivar'), handler);

export default router;
