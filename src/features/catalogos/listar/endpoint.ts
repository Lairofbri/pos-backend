import { Router } from 'express';
import { autenticar } from '../../../shared/middlewares/auth.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.get('/catalogos', autenticar, handler);

export default router;
