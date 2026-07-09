import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.delete('/categorias/:id', validarUuidParam('id', 'categoría'), requierePermiso('categorias.desactivar'), handler);
export default router;
