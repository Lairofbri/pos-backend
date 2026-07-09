import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.get('/menus', handler);

export default router;
