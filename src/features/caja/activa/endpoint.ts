import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.get('/caja/activa', handler);
export default router;
