import type { Request, Response } from 'express';
import { creado, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { crearSesionSchema } from './request.js';
import { crearSesion } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error al crear sesión de inventario', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = crearSesionSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const sesion = await crearSesion({
      tenantId: req.usuario!.tenant_id,
      usuarioId: req.usuario!.id,
      sucursalId: value.sucursal_id || req.sucursalId || null,
      notas: value.notas,
    });
    return creado(res, { sesion }, 'Sesión de inventario creada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};
