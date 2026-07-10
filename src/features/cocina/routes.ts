import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import listarEndpoint from './listar/endpoint.js';
import ticketEndpoint from './ticket/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(listarEndpoint);
router.use(ticketEndpoint);

export default router;
