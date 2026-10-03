import { Router } from 'express';
import { requiereRol } from '../../shared/middlewares/role.middleware.js';
import { handler as handlerCrearTenant } from './handler.js';
import { handler as handlerEstadoFiscal } from './estado-fiscal/handler.js';

// Alta de empresas (onboarding): SOLO rol plataforma.
// Un administrador normal NO puede crear tenants hermanos (spec §6.2).
// Consulta de estado fiscal (Fase 4): administrador o plataforma.
const router = Router({ mergeParams: true });

router.post('/provisioning/tenants', requiereRol('plataforma'), handlerCrearTenant);
router.get('/provisioning/estado-fiscal', requiereRol('administrador', 'plataforma'), handlerEstadoFiscal);

export default router;