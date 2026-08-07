import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';
import { revertirMovimiento } from './service.js';

export const handler = async (req: Request, res: Response) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID del movimiento no tiene un formato UUID válido.', 400);
  }

  try {
    const resultado = await revertirMovimiento({
      tenantId: req.usuario!.tenant_id,
      usuarioId: req.usuario!.id,
      movimientoId: req.params.id as string,
    });
    return exito(res, resultado, resultado.mensaje);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error al revertir movimiento', { error: (err as Error).message });
    return errorServidor(res);
  }
};
