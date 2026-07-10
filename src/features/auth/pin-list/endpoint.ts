import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });
router.get('/usuarios/pin-list', handler);
export default router;
