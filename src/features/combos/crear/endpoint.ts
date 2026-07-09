import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.post('/combos', requierePermiso('combos.crear'), handler);

export default router;
