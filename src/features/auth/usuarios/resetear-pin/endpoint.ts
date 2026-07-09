import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.post('/usuarios/:id/resetear-pin', validarUuidParam('id', 'usuario'), requierePermiso('usuarios.reset-pin'), handler);
export default router;
