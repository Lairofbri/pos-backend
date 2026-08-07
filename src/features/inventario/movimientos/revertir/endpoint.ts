import { Router } from 'express';
import { handler } from './handler.js';

const router = Router();
router.post('/inventario/movimientos/:id/revertir', handler);

export default router;
