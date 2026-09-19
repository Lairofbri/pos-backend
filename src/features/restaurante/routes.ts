import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import obtenerEndpoint from './obtener/endpoint.js';
import actualizarEndpoint from './actualizar/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(obtenerEndpoint);
router.use(actualizarEndpoint);

export default router;
