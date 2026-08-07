import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { rentabilidadHandler, evolucionHandler } from './handler.js';

const router = Router({ mergeParams: true });
router.get('/productos/rentabilidad', requierePermiso('productos.ver'), rentabilidadHandler);
router.get('/productos/rentabilidad/evolucion', requierePermiso('productos.ver'), evolucionHandler);
export default router;
