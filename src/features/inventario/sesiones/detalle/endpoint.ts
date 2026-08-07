import { Router } from 'express';
import { handler } from './handler.js';

const router = Router();
router.get('/inventario/sesiones/:id', handler);

export default router;
