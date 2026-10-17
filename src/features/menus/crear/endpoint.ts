import { Router } from 'express';
import { requiereRol } from '../../../shared/middlewares/role.middleware.js';
import { handler } from './handler.js';

const router = Router({ mergeParams: true });

// Los menús son un catálogo GLOBAL (aplica a todas las empresas): su
// mantenimiento queda reservado al rol plataforma (decisión 2026-10-16).
router.post('/menus', requiereRol('plataforma'), handler);

export default router;
