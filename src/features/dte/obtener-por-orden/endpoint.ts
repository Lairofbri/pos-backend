import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.get('/dte/orden/:ordenId', handler);

export default router;
