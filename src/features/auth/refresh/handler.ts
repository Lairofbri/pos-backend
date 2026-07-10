import type { Request, Response } from 'express';
import { refreshAccessToken } from '../shared.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { env } from '../../../shared/config/env.js';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.ES_PRODUCCION,
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function handler(req: Request, res: Response) {
  const cookieToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  const bodyToken = req.body?.refresh_token as string | undefined;
  const refreshToken = cookieToken || bodyToken;

  if (!refreshToken) {
    return error(res, 'Refresh token requerido.', 400);
  }

  try {
    const resultado = await refreshAccessToken({ refreshToken });
    const { refresh_token, ...data } = resultado;
    res.cookie(REFRESH_COOKIE, refresh_token, COOKIE_OPTS);
    return exito(res, data, 'Token renovado exitosamente.');
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
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
