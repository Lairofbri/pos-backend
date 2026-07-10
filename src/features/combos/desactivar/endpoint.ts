import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.delete('/combos/:id', validarUuidParam('id', 'combo'), requierePermiso('combos.desactivar'), handler);

export default router;
