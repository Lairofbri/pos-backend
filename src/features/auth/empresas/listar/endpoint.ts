import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.get('/empresas', handler);
export default router;
