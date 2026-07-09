import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.delete('/clientes/:id', validarUuidParam('id', 'cliente'), requierePermiso('clientes.desactivar'), handler);
export default router;
