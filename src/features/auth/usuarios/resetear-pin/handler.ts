import type { Request, Response } from 'express';
import { resetearPin } from '../../shared.js';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';

export async function handler(req: Request, res: Response) {
  const id = req.params.id as string;

  if (!esUuidValido(id)) {
    return error(res, 'El ID de usuario no tiene un formato UUID válido.', 400);
  }

  const pinNuevo = req.body?.pin_nuevo as string | undefined;
  if (!pinNuevo || !/^\d{6}$/.test(String(pinNuevo))) {
    return error(res, 'pin_nuevo debe tener exactamente 6 dígitos numéricos.', 400);
  }

  try {
    await resetearPin({
      tenantId: req.usuario!.tenant_id,
      usuarioId: id,
      pinNuevo,
    });
    return exito(res, null, 'PIN reseteado exitosamente.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en auth', {
      error: (err as Error).message,
      stack: (err as Error).stack,
      requestId: req.requestId,
    });
    return errorServidor(res);
  }
}
