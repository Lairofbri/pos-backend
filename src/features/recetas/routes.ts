import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import recetasListar from './listar/endpoint.js';
import recetasObtener from './obtener/endpoint.js';
import recetasPorProducto from './obtener-por-producto/endpoint.js';
import recetasCrear from './crear/endpoint.js';
import recetasActualizar from './actualizar/endpoint.js';
import recetasDesactivar from './desactivar/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(recetasListar);
router.use(recetasObtener);
router.use(recetasPorProducto);
router.use(recetasCrear);
router.use(recetasActualizar);
router.use(recetasDesactivar);

export default router;
