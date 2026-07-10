import type { Request, Response } from 'express';
import Joi from 'joi';
import { listarClientes } from './service.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

const filtrosClientesSchema = Joi.object({
  q: Joi.string().max(100).optional().allow(''),
  activo: Joi.boolean().optional(),
  pagina: Joi.number().integer().min(1).optional().default(1),
  limite: Joi.number().integer().min(1).max(100).optional().default(20),
});

export async function handler(req: Request, res: Response) {
  const paginaRaw = req.query.pagina ? Number(req.query.pagina) : 1;
  const limiteRaw = req.query.limite ? Number(req.query.limite) : 20;

  if (req.query.pagina && (!Number.isInteger(paginaRaw) || paginaRaw < 1)) {
    return error(res, 'El parámetro pagina debe ser un número entero positivo.', 400);
  }
  if (req.query.limite && (!Number.isInteger(limiteRaw) || limiteRaw < 1)) {
    return error(res, 'El parámetro limite debe ser un número entero positivo.', 400);
  }

  const { error: validacionError, value: filtros } = filtrosClientesSchema.validate({
    ...req.query,
    activo: req.query.activo !== undefined ? req.query.activo === 'true' : undefined,
    pagina: paginaRaw,
    limite: limiteRaw,
  });

  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const resultado = await listarClientes({
      tenantId: req.usuario!.tenant_id,
      filtros,
    });
    return exito(res, resultado);
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    if ((err as { code?: string }).code === '23505') return error(res, 'Ya existe un cliente con ese NIT o NRC.', 409);
    logger.error('Error no controlado en clientes', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
