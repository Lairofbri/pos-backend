import { Router } from 'express';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

router.get('/dte/:codigoGeneracion', handler);

export default router;
