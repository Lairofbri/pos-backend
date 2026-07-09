import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.patch('/combos/:id', validarUuidParam('id', 'combo'), requierePermiso('combos.editar'), handler);

export default router;
