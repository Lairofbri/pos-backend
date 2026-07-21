import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.post('/sucursales', requierePermiso('sucursales.crear'), handler);
export default router;
