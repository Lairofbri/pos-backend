import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.put('/permisos/rol/:rol', handler);

export default router;
