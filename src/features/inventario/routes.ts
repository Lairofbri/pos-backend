import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import resumenEndpoint from './resumen/endpoint.js';
import movimientosListar from './movimientos/listar/endpoint.js';
import movimientosCrear from './movimientos/crear/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(resumenEndpoint);
router.use(movimientosListar);
router.use(movimientosCrear);

export default router;
