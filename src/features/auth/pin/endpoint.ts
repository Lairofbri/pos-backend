import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.post('/auth/login-pin', handler);
export default router;
