import { Router } from 'express';
import { validarUuidParam } from '../../../../shared/middlewares/uuid.middleware.js';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.patch('/sucursales/:id', validarUuidParam('id', 'sucursal'), requierePermiso('sucursales.editar'), handler);
export default router;
