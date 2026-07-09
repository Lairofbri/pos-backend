import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { listarCategorias, listarArbolCategorias } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  if ((err as { code?: string }).code === '23505') return error(res, 'Ya existe un registro con ese nombre.', 409);
  logger.error('Error no controlado en productos', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  try {
    const esAdmin = req.usuario!.rol === 'administrador';
    const soloActivas = !esAdmin || req.query.todas !== 'true';
    const esArbol = req.query.arbol === 'true';

    if (esArbol) {
      const categorias = await listarArbolCategorias({ tenantId: req.usuario!.tenant_id, soloActivas });
      return exito(res, { categorias });
    }

    const categorias = await listarCategorias({ tenantId: req.usuario!.tenant_id, soloActivas });
    return exito(res, { categorias });
  } catch (err) {
    return manejarError(res, err);
  }
};
