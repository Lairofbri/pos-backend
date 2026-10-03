import { Router } from 'express';
import endpoint from './endpoint.js';

// Rutas internas de provisión (Fase 2) — montadas en /internal/provisioning,
// FUERA del apiV1 (no usan autenticación de usuario).
const router = Router();
router.use('/internal/provisioning', endpoint);
export default router;