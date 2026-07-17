import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.post('/dte/emitir', requierePermiso('dte.emitir'), handler);

export default router;
