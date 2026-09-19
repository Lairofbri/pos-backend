import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import { requierePermiso } from '../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../shared/middlewares/uuid.middleware.js';
import {
  listarHandler,
  activasHandler,
  obtenerHandler,
  crearHandler,
  actualizarHandler,
  desactivarHandler,
  reporteHandler,
} from './handler.js';

const router = Router({ mergeParams: true });
router.use(autenticar);

router.get('/promociones', requierePermiso('promociones.ver'), listarHandler);
router.get('/promociones/activas', requierePermiso('productos.ver'), activasHandler);
router.get('/promociones/reporte', requierePermiso('promociones.ver'), reporteHandler);
router.get('/promociones/:id', validarUuidParam('id', 'promoción'), requierePermiso('promociones.ver'), obtenerHandler);
router.post('/promociones', requierePermiso('promociones.gestionar'), crearHandler);
router.put('/promociones/:id', validarUuidParam('id', 'promoción'), requierePermiso('promociones.gestionar'), actualizarHandler);
router.delete('/promociones/:id', validarUuidParam('id', 'promoción'), requierePermiso('promociones.gestionar'), desactivarHandler);

export default router;
