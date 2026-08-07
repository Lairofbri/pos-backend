import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../../../shared/utils/response.js';
import { logger } from '../../../../shared/utils/logger.js';
import { esUuidValido } from '../../../../shared/middlewares/uuid.middleware.js';
import { query } from '../../../../shared/config/database.js';
import { registrarPagoSchema } from './request.js';
import { registrarPago } from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en registrar pago', { error: (err as Error).message, stack: (err as Error).stack });
  return errorServidor(res);
};

export const handler = async (req: Request, res: Response) => {
  if (!esUuidValido(req.params.id)) {
    return error(res, 'El ID de orden no tiene un formato UUID válido.', 400);
  }

  const { error: validacionError, value } = registrarPagoSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  if (idempotencyKey) {
    if (!esUuidValido(idempotencyKey)) {
      return error(res, 'Idempotency-Key debe ser un UUID válido.', 400);
    }

    const { rows: cached } = await query(
      'SELECT response FROM idempotency_keys WHERE key = $1',
      [idempotencyKey]
    );

    if (cached.length > 0) {
      const { status, body } = cached[0].response as { status: number; body: Record<string, unknown> };
      return res.status(status).json(body);
    }
  }

  try {
    const resultado = await registrarPago({
      tenantId: req.usuario!.tenant_id,
      ordenId: req.params.id as string,
      usuarioId: req.usuario!.id,
      datos: value,
    });

    const body = { ok: true, mensaje: 'Pago registrado exitosamente.', data: resultado };
    const status = 200;

    if (idempotencyKey) {
      await query(
        'INSERT INTO idempotency_keys (key, endpoint, response) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [idempotencyKey, '/ordenes/:id/pagar', JSON.stringify({ status, body })]
      );
    }

    return res.status(status).json(body);
  } catch (err) {
    return manejarError(res, err);
  }
};
