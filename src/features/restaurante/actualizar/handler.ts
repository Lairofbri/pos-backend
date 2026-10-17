import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { registrarIntentoEscrituraBloqueado, EVENTO_EMPRESA_BLOQUEADA } from '../../../shared/utils/auditoria.js';
import { camposEmpresaEnviados, MENSAJE_EMPRESA_SOLO_DTE } from '../../../shared/empresa.js';
import { actualizarRestauranteSchema } from './request.js';
import { actualizarRestaurante } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado al actualizar restaurante', {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  return errorServidor(res);
};

/**
 * PUT /api/v1/restaurante — F2 (2026-10-16).
 *
 * Solo se actualiza la configuración OPERATIVA del POS (`pos_default_mode`).
 * Cualquier intento de escribir identidad/config de EMPRESA devuelve 409 con
 * mensaje explícito ("se administra en el DTE") y se audita. No se persiste
 * nada del intento bloqueado.
 */
export const handler = async (req: Request, res: Response) => {
  const camposBloqueados = camposEmpresaEnviados(req.body as Record<string, unknown> | undefined);

  if (camposBloqueados.length > 0) {
    registrarIntentoEscrituraBloqueado({
      evento: EVENTO_EMPRESA_BLOQUEADA,
      tenantId: req.usuario!.tenant_id,
      usuarioId: req.usuario!.id,
      metodo: req.method,
      ruta: req.originalUrl,
      campos: camposBloqueados,
      ip: req.ip,
    });
    return error(res, MENSAJE_EMPRESA_SOLO_DTE, 409, { campos: camposBloqueados });
  }

  const { error: validacionError, value } = actualizarRestauranteSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const restaurante = await actualizarRestaurante({
      tenantId: req.usuario!.tenant_id,
      datos: value,
    });
    return exito(res, { restaurante }, 'Preferencias del POS actualizadas exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
