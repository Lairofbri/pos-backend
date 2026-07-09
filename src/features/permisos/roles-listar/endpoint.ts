import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.get('/permisos/roles', handler);

export default router;
