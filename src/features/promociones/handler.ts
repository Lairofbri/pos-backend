import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import {
  crearPromocionSchema,
  actualizarPromocionSchema,
  reportePromocionesSchema,
} from './request.js';
import {
  listarPromociones,
  obtenerPromocion,
  listarPromocionesActivas,
  crearPromocion,
  actualizarPromocion,
  desactivarPromocion,
  reportePromociones,
} from './service.js';

const manejarError = (res: Response, err: unknown) => {
  const e = err as { status?: number; mensaje?: string };
  if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
  logger.error('Error no controlado en promociones', {
    error: (err as Error).message,
    stack: (err as Error).stack,
  });
  return errorServidor(res);
};

export const listarHandler = async (req: Request, res: Response) => {
  try {
    const promociones = await listarPromociones({ tenantId: req.usuario!.tenant_id });
    return exito(res, { promociones });
  } catch (err) {
    return manejarError(res, err);
  }
};

export const activasHandler = async (req: Request, res: Response) => {
  try {
    const promociones = await listarPromocionesActivas({ tenantId: req.usuario!.tenant_id });
    return exito(res, { promociones });
  } catch (err) {
    return manejarError(res, err);
  }
};

export const obtenerHandler = async (req: Request, res: Response) => {
  try {
    const promocion = await obtenerPromocion({
      tenantId: req.usuario!.tenant_id,
      promoId: req.params.id as string,
    });
    return exito(res, { promocion });
  } catch (err) {
    return manejarError(res, err);
  }
};

export const crearHandler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = crearPromocionSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const promocion = await crearPromocion({
      tenantId: req.usuario!.tenant_id,
      datos: value,
    });
    return exito(res, { promocion }, 'Promoción creada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

export const actualizarHandler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = actualizarPromocionSchema.validate(req.body);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const promocion = await actualizarPromocion({
      tenantId: req.usuario!.tenant_id,
      promoId: req.params.id as string,
      datos: value,
    });
    return exito(res, { promocion }, 'Promoción actualizada exitosamente.');
  } catch (err) {
    return manejarError(res, err);
  }
};

export const desactivarHandler = async (req: Request, res: Response) => {
  try {
    const promocion = await desactivarPromocion({
      tenantId: req.usuario!.tenant_id,
      promoId: req.params.id as string,
    });
    return exito(res, { promocion }, 'Promoción desactivada.');
  } catch (err) {
    return manejarError(res, err);
  }
};

export const reporteHandler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = reportePromocionesSchema.validate(req.query);
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const reporte = await reportePromociones({
      tenantId: req.usuario!.tenant_id,
      desde: value.desde,
      hasta: value.hasta,
    });
    return exito(res, { reporte });
  } catch (err) {
    return manejarError(res, err);
  }
};
