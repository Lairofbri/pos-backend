import type { Request, Response } from 'express';
import { registrarMovimiento } from './service.js';
import { movimientoSchema } from './request.js';
import { esUuidValido } from '../../../shared/middlewares/uuid.middleware.js';
import { creado, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = movimientoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  if (value.sucursal_id && !esUuidValido(value.sucursal_id)) {
    return error(res, 'El campo sucursal_id no tiene un formato UUID válido.', 400);
  }

  try {
    const movimiento = await registrarMovimiento({
      tenantId: req.usuario!.tenant_id,
      usuarioId: req.usuario!.id,
      datos: value,
    });
    const msg = value.tipo === 'retiro'
      ? `Retiro de $${value.monto} registrado.`
      : `Depósito de $${value.monto} registrado.`;
    return creado(res, { movimiento }, msg);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en caja', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
