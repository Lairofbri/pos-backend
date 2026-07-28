import type { Request, Response } from 'express';
import { creado, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { crearMovimientoSchema } from './request.js';
import { crearMovimiento } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en inventario', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = crearMovimientoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  if (value.tipo === 'consumo') {
    return error(res, 'No se puede crear un movimiento de tipo consumo manualmente. El consumo se genera automáticamente al pagar.', 400);
  }

  try {
    const movimiento = await crearMovimiento({
      tenantId: req.usuario!.tenant_id,
      usuarioId: req.usuario!.id,
      sucursalId: req.sucursalId || null,
      datos: value,
    });
    return creado(res, { movimiento }, 'Movimiento registrado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
