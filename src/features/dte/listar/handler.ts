import type { Request, Response } from 'express';
import { listar } from './service.js';
import { listarDTESchema } from './request.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const paginaRaw = req.query.pagina ? Number(req.query.pagina) : 1;
  const limiteRaw = req.query.limite ? Number(req.query.limite) : 20;

  if (req.query.pagina && (!Number.isInteger(paginaRaw) || paginaRaw < 1)) {
    return error(res, 'pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limiteRaw) || limiteRaw < 1 || limiteRaw > 100)) {
    return error(res, 'limite debe ser un número entre 1 y 100.', 400);
  }

  const { error: validacionError, value: filtros } = listarDTESchema.validate({
    ...req.query,
    pagina: paginaRaw,
    limite: limiteRaw,
  });
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await listar({
      tenantId: req.usuario!.tenant_id,
      filtros: filtros as { pagina: number; limite: number; estado?: string; tipo_dte?: string; desde?: string; hasta?: string },
    });
    return exito(res, resultado);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en DTE listar', { error: (err as Error).message, requestId: req.requestId });
    return errorServidor(res);
  }
}
