import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/auth.middleware.js';
import endpoint from './endpoint.js';

const router = Router();
router.use(autenticar);
router.use(endpoint);
export default router;