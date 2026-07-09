import type { Request, Response } from 'express';
import * as service from './service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en impresion', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const listar = async (req: Request, res: Response) => {
  try {
    const impresoras = await service.listar(req.usuario!.tenant_id);
    return exito(res, impresoras);
  } catch (err) { return manejarError(res, err); }
};

export const crear = async (req: Request, res: Response) => {
  try {
    const impresora = await service.crear(req.usuario!.tenant_id, req.body);
    return exito(res, impresora, 'Impresora creada exitosamente.', 201);
  } catch (err) { return manejarError(res, err); }
};

export const actualizar = async (req: Request, res: Response) => {
  try {
    const impresora = await service.actualizar(req.usuario!.tenant_id, req.params.id as string, req.body);
    return exito(res, impresora);
  } catch (err) { return manejarError(res, err); }
};

export const eliminar = async (req: Request, res: Response) => {
  try {
    await service.eliminar(req.usuario!.tenant_id, req.params.id as string);
    return exito(res, { eliminado: true });
  } catch (err) { return manejarError(res, err); }
};
