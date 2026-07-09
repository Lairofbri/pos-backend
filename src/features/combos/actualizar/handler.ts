import type { Request, Response } from 'express';
import { actualizarCombo } from './service.js';
import { actualizarComboSchema } from './request.js';
import { exito, error, errorServidor } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';

export async function handler(req: Request, res: Response) {
  const { error: validacionError, value } = actualizarComboSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const combo = await actualizarCombo({ tenantId: req.usuario!.tenant_id, comboId: req.params.id as string, datos: value });
    return exito(res, { combo }, 'Combo actualizado exitosamente.');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error no controlado en combos', { error: (err as Error).message, stack: (err as Error).stack });
    return errorServidor(res);
  }
}
