import type { Request, Response } from 'express';
import { error, errorServidor } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import { crearTenantPosSchema } from './request.js';
import { servicioProvisionPos } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado al provisionar empresa', {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  // operation_id puede venir del header Idempotency-Key o del body.
  const operationIdHeader = req.headers['idempotency-key'] as string | undefined;
  const bodyConOperation = operationIdHeader
    ? { ...req.body, operation_id: operationIdHeader }
    : req.body;

  const { error: validacionError, value } = crearTenantPosSchema.validate(bodyConOperation);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await servicioProvisionPos.crearTenantPos({
      tenantIdOperador: req.usuario!.tenant_id,
      datos: value,
      operationId: value.operation_id,
    });
    return res.status(resultado.status).json(resultado.body);
  } catch (err) {
    return manejarError(res, err);
  }
};