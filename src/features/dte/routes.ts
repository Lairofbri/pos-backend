import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import emitirEndpoint from './emitir/endpoint.js';
import anularEndpoint from './anular/endpoint.js';
import listarEndpoint from './listar/endpoint.js';
import obtenerEndpoint from './obtener/endpoint.js';
import obtenerPorOrdenEndpoint from './obtener-por-orden/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(emitirEndpoint);
router.use(anularEndpoint);
router.use(listarEndpoint);
router.use(obtenerEndpoint);
router.use(obtenerPorOrdenEndpoint);

export default router;
