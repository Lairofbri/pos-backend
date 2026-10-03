import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { recibirEventoSchema } from './request.js';
import { servicioEventosProvision } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  if ((err as { code?: string }).code === '23505') return error(res, 'Operación de provisión duplicada.', 409);
  logger.error('Error no controlado al recibir evento de provisión', {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = recibirEventoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await servicioEventosProvision.recibirEvento({
      operationId: value.operation_id,
      tipoEvento: value.tipo_evento,
      tenantId: value.tenant_id,
      payload: value.payload,
    });
    return exito(res, resultado.body.data, 'Evento de provisión procesado.');
  } catch (err) {
    return manejarError(res, err);
  }
};