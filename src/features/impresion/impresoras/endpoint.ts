import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { listar, crear, actualizar, eliminar } from './handler.js';

const router = Router({ mergeParams: true });

router.get('/impresion', requierePermiso('impresion.configurar'), listar);
router.post('/impresion', requierePermiso('impresion.configurar'), crear);
router.put('/impresion/:id', validarUuidParam('id', 'impresora'), requierePermiso('impresion.configurar'), actualizar);
router.delete('/impresion/:id', validarUuidParam('id', 'impresora'), requierePermiso('impresion.configurar'), eliminar);

export default router;
