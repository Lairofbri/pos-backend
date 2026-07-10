import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.post('/auth/refresh', handler);
export default router;
