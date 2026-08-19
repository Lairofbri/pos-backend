import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { listarCuentasSchema, exportarCuentasSchema } from './request.js';
import { listarCuentas, exportarCuentas } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en cuentas', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const listarHandler = async (req: Request, res: Response) => {
  const paginaRaw = req.query.pagina ? Number(req.query.pagina) : 1;
  const limiteRaw = req.query.limite ? Number(req.query.limite) : 50;

  if (req.query.pagina && (!Number.isInteger(paginaRaw) || paginaRaw < 1)) {
    return error(res, 'pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limiteRaw) || limiteRaw < 1 || limiteRaw > 100)) {
    return error(res, 'limite debe ser un número entre 1 y 100.', 400);
  }

  const { error: validacionError, value: filtros } = listarCuentasSchema.validate({
    ...req.query,
    pagina: paginaRaw,
    limite: limiteRaw,
  });

  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await listarCuentas({
      tenantId: req.usuario!.tenant_id,
      sucursalId: req.sucursalId,
      filtros,
    });
    return exito(res, resultado);
  } catch (err) {
    return manejarError(res, err);
  }
};

export const exportarHandler = async (req: Request, res: Response) => {
  const { error: validacionError, value: filtros } = exportarCuentasSchema.validate(req.query);

  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const cuentas = await exportarCuentas({
      tenantId: req.usuario!.tenant_id,
      sucursalId: req.sucursalId,
      filtros,
    });
    return exito(res, cuentas);
  } catch (err) {
    return manejarError(res, err);
  }
};
