import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.put('/recetas/:id', validarUuidParam('id', 'receta'), requierePermiso('recetas.gestionar'), handler);
export default router;
