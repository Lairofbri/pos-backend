import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.post('/permisos/rol/:rol/reset', handler);

export default router;
