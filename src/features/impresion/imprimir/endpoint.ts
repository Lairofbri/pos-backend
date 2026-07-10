import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { imprimir, imprimirPrueba } from './handler.js';

const router = Router({ mergeParams: true });

router.post('/impresion/print/:ordenId', requierePermiso('ordenes.ver'), imprimir);
router.post('/impresion/test', requierePermiso('impresion.configurar'), imprimirPrueba);

export default router;
