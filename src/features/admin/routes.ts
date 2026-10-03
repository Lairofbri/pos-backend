import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import sucursalesListar from './sucursales/listar/endpoint.js';
import sucursalesObtener from './sucursales/obtener/endpoint.js';
import sucursalesCrear from './sucursales/crear/endpoint.js';
import sucursalesActualizar from './sucursales/actualizar/endpoint.js';
import sucursalesVincular from './sucursales/vincular/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(sucursalesListar);
router.use(sucursalesObtener);
router.use(sucursalesCrear);
router.use(sucursalesActualizar);
router.use(sucursalesVincular);

export default router;
