import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.get('/auth/me', handler);
export default router;
