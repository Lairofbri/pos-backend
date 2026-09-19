import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import alertasEndpoint from './endpoint.js';

const router = Router({ mergeParams: true });
router.use(autenticar);
router.use(alertasEndpoint);

export default router;