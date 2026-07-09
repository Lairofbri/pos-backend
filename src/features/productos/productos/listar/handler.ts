import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';
import { filtrosProductosSchema } from './request.js';
import { listarProductos } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  if ((err as { code?: string }).code === '23505') return error(res, 'Ya existe un registro con ese nombre.', 409);
  logger.error('Error no controlado en productos', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const paginaRaw = req.query.pagina ? Number(req.query.pagina) : 1;
  const limiteRaw = req.query.limite ? Number(req.query.limite) : 50;

  if (req.query.pagina && (!Number.isInteger(paginaRaw) || paginaRaw < 1)) {
    return error(res, 'El parámetro pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limiteRaw) || limiteRaw < 1)) {
    return error(res, 'El parámetro limite debe ser un número entero positivo.', 400);
  }

  if (req.query.categoria_id && !esUuidValido(req.query.categoria_id)) {
    return error(res, 'El parámetro categoria_id no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value: filtros } = filtrosProductosSchema.validate({
    ...req.query,
    activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined,
    con_stock: req.query.con_stock !== undefined ? req.query.con_stock === 'true' : undefined,
    pagina: paginaRaw,
    limite: limiteRaw,
  });

  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await listarProductos({
      tenantId: req.usuario!.tenant_id,
      filtros,
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};
