import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { actualizarCategoriaSchema } from './request.js';
import { actualizarCategoria } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  if ((err as { code?: string }).code === '23505') return error(res, 'Ya existe un registro con ese nombre.', 409);
  logger.error('Error no controlado en productos', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = actualizarCategoriaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const categoria = await actualizarCategoria({
      tenantId: req.usuario!.tenant_id,
      categoriaId: req.params.id as string,
      datos: value,
    });
    return exito(res, { categoria }, 'Categoría actualizada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
