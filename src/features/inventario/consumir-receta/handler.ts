import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { consumirRecetaSchema } from './request.js';
import { consumirReceta } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error al consumir receta', { error: (err as Error).message });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = consumirRecetaSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await consumirReceta({
      tenantId: req.usuario!.tenant_id,
      recetaId: value.receta_id,
      cantidad: value.cantidad,
      motivo: value.motivo,
      usuarioId: req.usuario!.id,
      sucursalId: req.usuario!.sucursal_id ?? undefined,
    });
    return exito(res, resultado, 'Consumo de receta registrado.', 201);
  } catch (err) {
    return manejarError(res, err);
  }
};
