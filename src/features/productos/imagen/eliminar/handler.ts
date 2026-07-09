import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { eliminarImagenProducto } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  if ((err as { code?: string }).code === '23505') return error(res, 'Ya existe un registro con ese nombre.', 409);
  logger.error('Error no controlado en productos', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const eliminarImagen = async (req: Request, res: Response) => {
  try {
    const producto = await eliminarImagenProducto({
      tenantId: req.usuario!.tenant_id,
      productoId: req.params.id as string,
    });
    return exito(res, { producto }, 'Imagen eliminada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
