import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import impresorasEndpoint from './impresoras/endpoint.js';
import imprimirEndpoint from './imprimir/endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(impresorasEndpoint);
router.use(imprimirEndpoint);

export default router;
