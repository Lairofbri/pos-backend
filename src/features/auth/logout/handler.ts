import type { Request, Response } from 'express';
import { logout } from '../shared.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

const REFRESH_COOKIE = 'refresh_token';

export async function handler(req: Request, res: Response) {
  const cookieToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  const bodyToken = req.body?.refresh_token as string | undefined;
  const refreshToken = cookieToken || bodyToken;

  if (!refreshToken) {
    return error(res, 'Refresh token requerido.', 400);
  }

  try {
    await logout({ refreshToken, tenantId: req.usuario!.tenant_id });
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    return exito(res, null, 'Sesión cerrada exitosamente.');
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
