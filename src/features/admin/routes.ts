import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import sucursalesListar from './sucursales/listar/endpoint.js';
import sucursalesObtener from './sucursales/obtener/endpoint.js';
import sucursalesCrear from './sucursales/crear/endpoint.js';
import sucursalesActualizar from './sucursales/actualizar/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(sucursalesListar);
router.use(sucursalesObtener);
// F5: el alta/edición de sucursales vive SOLO en el DTE. Las rutas de escritura
// se conservan para responder 409 con auditoría; el reintento de vínculo fiscal
// (`POST /sucursales/:id/vincular`) se retiró junto con la tabla local.
router.use(sucursalesCrear);
router.use(sucursalesActualizar);

export default router;
