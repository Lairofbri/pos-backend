import type { Request, Response } from 'express';
import { obtenerMenus } from './service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  try {
    const menus = await obtenerMenus({
      tenantId: req.usuario!.tenant_id,
      rol: req.usuario!.rol,
      esAdmin: req.usuario!.rol === 'administrador',
    });
    return exito(res, { menus });
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error en menús', { error: (err as Error).message });
    return errorServidor(res);
  }
}
