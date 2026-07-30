import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.post('/inventario/consumir-receta', requierePermiso('inventario.gestionar'), handler);
export default router;
