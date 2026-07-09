import type { Request, Response } from 'express';
import { crearCliente } from './service.js';
import { crearClienteSchema } from './request.js';
import { creado, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = crearClienteSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const cliente = await crearCliente({
      tenantId: req.usuario!.tenant_id,
      datos: value,
    });
    return creado(res, { cliente }, 'Cliente creado exitosamente.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    if ((err as { code?: string }).code === '23505') return error(res, 'Ya existe un cliente con ese NIT o NRC.', 409);
    logger.error('Error no controlado en clientes', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
