import { Router } from 'express';
import { autenticarApiKeyInterna } from '../../../shared/middlewares/internal-key.middleware.js';
import { handler } from './handler.js';

// Ruta interna servidor-a-servidor: la consume el outbox del DTE Service.
// NO requiere JWT de usuario — se autentica con la clave interna.
const router = Router({ mergeParams: true });
router.use(autenticarApiKeyInterna);
router.post('/events', handler);
export default router;