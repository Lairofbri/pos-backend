import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.get('/combos/:id', validarUuidParam('id', 'combo'), requierePermiso('combos.ver'), handler);

export default router;
