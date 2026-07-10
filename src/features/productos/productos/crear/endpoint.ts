import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.post('/productos', requierePermiso('productos.crear'), handler);
export default router;
