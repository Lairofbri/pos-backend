import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import buscarEndpoint from './buscar/endpoint.js';
import listarEndpoint from './listar/endpoint.js';
import obtenerEndpoint from './obtener/endpoint.js';
import crearEndpoint from './crear/endpoint.js';
import actualizarEndpoint from './actualizar/endpoint.js';
import desactivarEndpoint from './desactivar/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(buscarEndpoint);
router.use(listarEndpoint);
router.use(obtenerEndpoint);
router.use(crearEndpoint);
router.use(actualizarEndpoint);
router.use(desactivarEndpoint);

export default router;
