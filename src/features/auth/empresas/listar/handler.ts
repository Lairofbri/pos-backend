import type { Request, Response } from 'express';
import { servicioEmpresaDte } from '../../../../shared/dte-empresa.js';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';

/**
 * GET /api/v1/empresas — selector de empresa del login (público).
 *
 * F3 (spec «DTE única fuente de verdad», 2026-10-16): la lista de empresas y
 * sus sucursales ya NO sale de la tabla local `tenants`/`sucursales`; se
 * consulta al DTE Service (`GET /api/tenants` + `/internal/.../empresa`,
 * server-a-server, la clave interna nunca va al navegador).
 */
export async function handler(req: Request, res: Response) {
  try {
    const { tenants, sucursales } = await servicioEmpresaDte.listarEmpresasParaLogin();
    return exito(res, { tenants, sucursales });
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en auth', {
      error: (err as Error).message,
      stack: (err as Error).stack,
      requestId: req.requestId,
    });
    return errorServidor(res);
  }
}
