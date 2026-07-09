import type { Request, Response } from 'express';
import { creado, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { crearProductoSchema } from './request.js';
import { crearProducto } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  if ((err as { code?: string }).code === '23505') return error(res, 'Ya existe un registro con ese nombre.', 409);
  logger.error('Error no controlado en productos', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = crearProductoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const producto = await crearProducto({
      tenantId: req.usuario!.tenant_id,
      datos: value,
    });
    return creado(res, { producto }, 'Producto creado exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
