import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.post('/menus', requierePermiso('menus.crear'), handler);

export default router;
