import type { Request, Response } from 'express';
import { exito, error, errorServidor } from '../../shared/utils/response.js';
import { logger } from '../../shared/utils/logger.js';
import {
  obtenerAlertas,
  obtenerConfigAlertas,
  guardarConfigAlertas,
  resolverAlerta,
  listarHistorialAlertas,
} from './service.js';
import { evaluarYNotificar } from './notificar.js';
import { configAlertasSchema } from './request.js';

export const handler = async (req: Request, res: Response) => {
  try {
    const alertas = await obtenerAlertas({
      tenantId: req.usuario!.tenant_id,
      sucursalId: req.sucursalId,
    });
    return exito(res, { alertas });
  } catch (err) {
    logger.error('Error al obtener alertas', {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    return errorServidor(res);
  }
};

export const resolverHandler = async (req: Request, res: Response) => {
  try {
    const resultado = await resolverAlerta({
      tenantId: req.usuario!.tenant_id,
      alertaId: req.params.alertaId as string,
    });
    void evaluarYNotificar(req.usuario!.tenant_id);
    return exito(res, resultado, 'Alerta resuelta');
  } catch (err) {
    const e = err as { status?: number; mensaje?: string };
    if (e.status && e.mensaje) return error(res, e.mensaje, e.status);
    logger.error('Error al resolver alerta', { error: (err as Error).message });
    return errorServidor(res);
  }
};

export const historialHandler = async (req: Request, res: Response) => {
  try {
    const historial = await listarHistorialAlertas({ tenantId: req.usuario!.tenant_id });
    return exito(res, { historial });
  } catch (err) {
    logger.error('Error al obtener historial de alertas', { error: (err as Error).message });
    return errorServidor(res);
  }
};

export const configGetHandler = async (req: Request, res: Response) => {
  try {
    const config = await obtenerConfigAlertas({ tenantId: req.usuario!.tenant_id });
    return exito(res, { config });
  } catch (err) {
    logger.error('Error al obtener config de alertas', { error: (err as Error).message });
    return errorServidor(res);
  }
};

export const configPutHandler = async (req: Request, res: Response) => {
  const { error: validacionError, value } = configAlertasSchema.validate(req.body, { stripUnknown: true });
  if (validacionError) return error(res, validacionError.details[0].message, 400);

  try {
    const config = await guardarConfigAlertas({ tenantId: req.usuario!.tenant_id, datos: value });
    void evaluarYNotificar(req.usuario!.tenant_id);
    return exito(res, { config }, 'Configuración de alertas guardada');
  } catch (err) {
    logger.error('Error al guardar config de alertas', { error: (err as Error).message });
    return errorServidor(res);
  }
};