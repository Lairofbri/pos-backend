import { Router } from 'express';
import { requierePermiso } from '../../../shared/middlewares/permisos.middleware.js';
import { validarUuidParam } from '../../../shared/middlewares/uuid.middleware.js';
import { imprimir, imprimirPrueba, ticketEscpos } from './handler.js';

const router = Router({ mergeParams: true });

// Bytes ESC/POS para el agente local (no imprime: devuelve el flujo de bytes).
router.get('/impresion/ticket-escpos/:ordenId', validarUuidParam('ordenId', 'orden'), requierePermiso('ordenes.ver'), ticketEscpos);
// Camino TCP directo (impresoras de red): sigue disponible (decisión D4).
router.post('/impresion/print/:ordenId', requierePermiso('ordenes.ver'), imprimir);
router.post('/impresion/test', requierePermiso('impresion.configurar'), imprimirPrueba);

export default router;
