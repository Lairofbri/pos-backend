import { Router } from 'express';
import { validarUuidParam } from '../../../../shared/middlewares/uuid.middleware.js';
import { requierePermiso } from '../../../../shared/middlewares/permisos.middleware.js';
import { handler } from './handler.js';

// Fase 3: reintento idempotente del vínculo fiscal (POST /sucursales/:id/vincular).
const router = Router({ mergeParams: true });
router.post('/sucursales/:id/vincular', validarUuidParam('id', 'sucursal'), requierePermiso('sucursales.editar'), handler);
export default router;