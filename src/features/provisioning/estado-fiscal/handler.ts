import type { Request, Response } from 'express';
import { error, errorServidor, exito } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { servicioEstadoFiscal } from './service.js';

/**
 * GET /api/v1/provisioning/estado-fiscal
 * Estado fiscal consultable por el POS (Fase 4).
 *
 * Admin y plataforma pueden consultar el estado fiscal de SU tenant. El
 * payload proviene del DTE Service y nunca contiene secretos Hacienda.
 */
const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado al consultar estado fiscal', {
    error: err instanceof Error ? err.message : String(err),
  });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  try {
    const estado = await servicioEstadoFiscal.consultarEstadoFiscal({
      tenantId: req.usuario!.tenant_id,
    });
    return exito(res, estado, 'Estado fiscal consultado.');
  } catch (err) {
    return manejarError(res, err);
  }
};