import type { Request, Response } from 'express';
import { buscarClientes } from './service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { q } = req.query;

  try {
    const clientes = await buscarClientes({
      tenantId: req.usuario!.tenant_id,
      q: q as string | undefined,
    });
    return exito(res, { clientes });
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    if ((err as { code?: string }).code === '23505') return error(res, 'Ya existe un cliente con ese NIT o NRC.', 409);
    logger.error('Error no controlado en clientes', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
