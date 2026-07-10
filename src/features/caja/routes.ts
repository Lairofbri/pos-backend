import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import abrirEndpoint from './abrir/endpoint.js';
import activaEndpoint from './activa/endpoint.js';
import cerrarEndpoint from './cerrar/endpoint.js';
import verificarCuadreEndpoint from './verificar-cuadre/endpoint.js';
import cuadreEndpoint from './cuadre/endpoint.js';
import movimientoEndpoint from './movimiento/endpoint.js';
import movimientosEndpoint from './movimientos/endpoint.js';
import historialEndpoint from './historial/endpoint.js';
import resumenDiarioEndpoint from './resumen-diario/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(abrirEndpoint);
router.use(activaEndpoint);
router.use(cerrarEndpoint);
router.use(verificarCuadreEndpoint);
router.use(cuadreEndpoint);
router.use(movimientoEndpoint);
router.use(movimientosEndpoint);
router.use(historialEndpoint);
router.use(resumenDiarioEndpoint);

export default router;
