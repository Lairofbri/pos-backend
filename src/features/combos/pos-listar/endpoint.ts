import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.get('/combos/pos', handler);

export default router;
