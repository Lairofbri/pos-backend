import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { guardarApiKeyDteSchema } from './request.js';
import { servicioEventosProvision } from './service.js';

/**
 * POST /internal/provisioning/tenants/:tenantId/api-key
 *
 * Entrega automática de la API Key de integración POS → DTE (2026-10-17): el DTE
 * genera la clave, guarda solo el hash y la envía por este canal interno
 * (autenticado con `X-Internal-Api-Key`, red privada). El POS la cifra y la
 * guarda; nunca se devuelve ni se loguea.
 */
export const apikeyHandler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = guardarApiKeyDteSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  const tenantId = String(req.params.tenantId ?? '').trim().toLowerCase();

  try {
    const resultado = await servicioEventosProvision.guardarApiKeyDte({
      tenantId,
      apiKey: value.api_key,
    });
    return exito(res, resultado, 'API Key de integración guardada.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado al guardar la API Key de integración', {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    return errorServidor(res);
  }
};
