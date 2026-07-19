import type { Request, Response } from 'express';
import { loginPin } from '../shared.js';
import { loginPinSchema } from './request.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { env } from '../../../shared/config/env.js';
import { esUuidValido } from '../../../shared/middlewares/uuid.middleware.js';

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.ES_PRODUCCION,
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function handler(req: Request, res: Response) {
  const tenantId = req.headers['x-tenant-id'] as string | undefined;

  if (!tenantId) {
    return error(res, 'Header X-Tenant-Id requerido.', 400);
  }

  if (!esUuidValido(tenantId)) {
    return error(res, 'El header X-Tenant-Id no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = loginPinSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await loginPin({
      tenantId,
      usuarioId: value.usuario_id || undefined,
      pin: value.pin,
      ip: req.ip,
    });
    const { refresh_token, ...data } = resultado;
    res.cookie(REFRESH_COOKIE, refresh_token, COOKIE_OPTS);
    return exito(res, data, 'Sesión iniciada exitosamente.');
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
