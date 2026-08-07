import { Router } from 'express';
import { handler } from './handler.js';

const router = Router();
router.post('/inventario/sesiones/:id/cerrar', handler);

export default router;
