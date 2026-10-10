import { Router } from 'express';
import { requiereRol } from '../../shared/middlewares/role.middleware.js';
import { handler as handlerEstadoFiscal } from './estado-fiscal/handler.js';

// Consulta de estado fiscal (Fase 4): administrador o plataforma.
// NOTA (077, decisión 2026-10-07): el alta de empresas (POST
// /provisioning/tenants) se eliminó del POS — el mantenimiento "Crear
// empresa" vive solo en el DTE Frontend. El POS conserva la proyección y el
// consumo de eventos (src/features/internal/provisioning).
const router = Router({ mergeParams: true });

router.get('/provisioning/estado-fiscal', requiereRol('administrador', 'plataforma'), handlerEstadoFiscal);

export default router;