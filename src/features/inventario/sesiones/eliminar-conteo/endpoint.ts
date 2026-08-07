import { Router } from 'express';
import { handler } from './handler.js';

const router = Router();
router.delete('/inventario/sesiones/:id/conteos/:productoId', handler);

export default router;
