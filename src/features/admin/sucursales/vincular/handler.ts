import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { servicioVinculoSucursal } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado al vincular sucursal', {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  try {
    const resultado = await servicioVinculoSucursal.vincular({
      tenantId: req.usuario!.tenant_id,
      sucursalId: String(req.params.id),
    });
    return exito(
      res,
      { sucursal: resultado.sucursal },
      resultado.duplicado ? 'La sucursal ya está vinculada.' : 'Vínculo fiscal procesado.'
    );
  } catch (err) {
    return manejarError(res, err);
  }
};