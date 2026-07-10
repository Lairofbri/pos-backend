import { Router } from 'express';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../../shared/middlewares/uuid.middleware.js';
import { eliminarImagen } from './handler.js';

const router = Router({ mergeParams: true });

router.delete('/productos/:id/imagen', validarUuidParam('id', 'producto'), requierePermiso('productos.editar'), eliminarImagen);

export default router;
