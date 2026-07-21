import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { actualizarSucursalSchema } from './request.js';
import { actualizarSucursal } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado al actualizar sucursal', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = actualizarSucursalSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const sucursal = await actualizarSucursal({
      tenantId: req.usuario!.tenant_id,
      sucursalId: req.params.id as string,
      datos: value,
    });
    return exito(res, { sucursal }, 'Sucursal actualizada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
