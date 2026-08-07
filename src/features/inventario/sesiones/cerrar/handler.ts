import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { cerrarSesionSchema } from './request.js';
import { cerrarSesion } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error al cerrar sesión de inventario', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = cerrarSesionSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await cerrarSesion({
      sesionId: req.params.id as string,
      tenantId: req.usuario!.tenant_id,
      usuarioId: req.usuario!.id,
      sucursalId: req.sucursalId || null,
      lineas: value.lineas,
    });
    return exito(res, resultado, `Sesión cerrada. ${resultado.ajustes_aplicados} ajustes aplicados, ${resultado.ignorados} ignorados.`);
  } catch (err) {
    return manejarError(res, err);
  }
};
