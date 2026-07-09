import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.post('/caja/abrir', requierePermiso('caja.abrir'), handler);
export default router;
