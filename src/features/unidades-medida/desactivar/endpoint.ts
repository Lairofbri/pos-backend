import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.delete('/unidades-medida/:id', validarUuidParam('id', 'unidad'), requierePermiso('unidades.gestionar'), handler);
export default router;
