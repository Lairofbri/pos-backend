import { Router } from 'express';
import { requiereRol } from '../../../shared/middlewares/role.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

// Detalle usado por el mantenimiento del catálogo global: solo rol plataforma.
router.get('/menus/:id', validarUuidParam('id', 'menú'), requiereRol('plataforma'), handler);

export default router;
