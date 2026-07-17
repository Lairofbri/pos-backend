import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.post('/dte/anular', requierePermiso('dte.anular'), handler);

export default router;
