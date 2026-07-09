import type { Request, Response } from 'express';
import { verificarCuadre } from './service.js';
import { verificarCuadreSchema } from './request.js';
import { esUuidValido } from '../../../shared/middlewares/uuid.middleware.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = verificarCuadreSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  if (value.sucursal_id && !esUuidValido(value.sucursal_id)) {
    return error(res, 'El campo sucursal_id no tiene un formato UUID válido.', 400);
  }

  try {
    const resultado = await verificarCuadre({
      tenantId: req.usuario!.tenant_id,
      datos: value,
    });
    return exito(res, resultado);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en caja', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
