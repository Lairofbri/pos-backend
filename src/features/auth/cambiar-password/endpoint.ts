import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.put('/auth/cambiar-password', handler);
export default router;
