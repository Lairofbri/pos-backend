import type { Request, Response } from 'express';
import { getMovimientos } from './service.js';
import { esUuidValido } from '../../../shared/middlewares/uuid.middleware.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de caja no tiene un formato UUID válido.', 400);
  }

  const paginaRaw = req.query.pagina ? Number(req.query.pagina) : 1;
  const limiteRaw = req.query.limite ? Number(req.query.limite) : 50;

  if (req.query.pagina && (!Number.isInteger(paginaRaw) || paginaRaw < 1)) {
    return error(res, 'El parámetro pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limiteRaw) || limiteRaw < 1 || limiteRaw > 100)) {
    return error(res, 'El parámetro limite debe ser un número entero entre 1 y 100.', 400);
  }

  try {
    const resultado = await getMovimientos({
      tenantId: req.usuario!.tenant_id,
      cajaId: req.params.id as string,
      pagina: paginaRaw,
      limite: limiteRaw,
    });
    return exito(res, resultado);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en caja', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
