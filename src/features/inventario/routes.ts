import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import resumenEndpoint from './resumen/endpoint.js';
import productosEndpoint from './productos/endpoint.js';
import movimientosListar from './movimientos/listar/endpoint.js';
import movimientosCrear from './movimientos/crear/endpoint.js';
import consumirReceta from './consumir-receta/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(resumenEndpoint);
router.use(productosEndpoint);
router.use(movimientosListar);
router.use(movimientosCrear);
router.use(consumirReceta);

export default router;
