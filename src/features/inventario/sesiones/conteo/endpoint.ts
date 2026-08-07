import { Router } from 'express';
import { handler } from './handler.js';

const router = Router();
router.put('/inventario/sesiones/:id/conteos', handler);

export default router;
