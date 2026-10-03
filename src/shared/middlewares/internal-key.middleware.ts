import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { noAutenticado, errorServidor } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * Autenticación servidor-a-servidor para rutas internas (Fase 2).
 * Valida X-Internal-Api-Key contra env.INTERNAL_API_KEY en tiempo constante.
 * Fail-closed: si la clave no está configurada, la ruta interna no opera.
 */
export const autenticarApiKeyInterna = (req: Request, res: Response, next: NextFunction) => {
  if (!env.INTERNAL_API_KEY) {
    logger.error('INTERNAL_API_KEY no configurada — rutas internas deshabilitadas');
    return errorServidor(res, 'Configuración interna incompleta.');
  }

  const recibida = req.headers['x-internal-api-key'];
  if (!recibida) {
    return noAutenticado(res, 'Clave interna requerida.');
  }

  const a = Buffer.from(String(recibida));
  const b = Buffer.from(env.INTERNAL_API_KEY);
  const coinciden = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!coinciden) {
    logger.warn('Clave interna inválida', { ip: req.ip, ruta: req.path });
    return noAutenticado(res, 'Clave interna inválida.');
  }

  req.origenInterno = 'dte-service';
  next();
};