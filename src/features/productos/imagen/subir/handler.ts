import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { subirImagenProducto } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  if ((err as { code?: string }).code === '23505') return error(res, 'Ya existe un registro con ese nombre.', 409);
  logger.error('Error no controlado en productos', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const subirImagen = async (req: Request, res: Response) => {
  if (!req.file) {
    return error(res, 'Debe enviar una imagen en el campo "imagen".', 400);
  }

  try {
    const producto = await subirImagenProducto({
      tenantId: req.usuario!.tenant_id,
      productoId: req.params.id as string,
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
    });
    return exito(res, { producto }, 'Imagen subida exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
