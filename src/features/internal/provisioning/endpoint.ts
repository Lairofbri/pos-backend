import { Router } from 'express';
import { autenticarApiKeyInterna } from '../../../shared/middlewares/internal-key.middleware.js';
import { handler } from './handler.js';
import { apikeyHandler } from './apikey-handler.js';

// Ruta interna servidor-a-servidor: la consume el outbox del DTE Service.
// NO requiere JWT de usuario — se autentica con la clave interna.
const router = Router({ mergeParams: true });
router.use(autenticarApiKeyInterna);
router.post('/events', handler);
// Entrega automática de la API Key de integración (2026-10-17).
router.post('/tenants/:tenantId/api-key', apikeyHandler);
export default router;