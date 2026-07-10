import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.post('/auth/logout', handler);
export default router;
