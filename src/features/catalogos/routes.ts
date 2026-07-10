import { Router } from 'express';
import listarEndpoint from './listar/endpoint.js';

const router = Router({ mergeParams: true });
router.use(listarEndpoint);

export default router;
