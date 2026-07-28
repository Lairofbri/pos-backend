import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.get('/recetas/producto/:productoId', validarUuidParam('productoId', 'producto'), requierePermiso('recetas.ver'), handler);
export default router;
