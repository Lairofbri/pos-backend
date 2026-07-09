import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.get('/permisos', handler);

export default router;
