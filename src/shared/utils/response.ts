import type { Response } from 'express';

export const exito = (res: Response, data: unknown = null, mensaje = 'OK', status = 200) => {
  return res.status(status).json({
    ok: true,
    mensaje,
    data,
  });
};

export const creado = (res: Response, data: unknown = null, mensaje = 'Recurso creado exitosamente') => {
  return exito(res, data, mensaje, 201);
};

export const error = (res: Response, mensaje = 'Error en la solicitud', status = 400, errores: unknown = null) => {
  const cuerpo: Record<string, unknown> = { ok: false, mensaje };
  if (errores) cuerpo.errores = errores;
  return res.status(status).json(cuerpo);
};

export const noAutenticado = (res: Response, mensaje = 'No autenticado. Inicia sesión para continuar.') => {
  return error(res, mensaje, 401);
};

export const sinPermiso = (res: Response, mensaje = 'No tienes permiso para realizar esta acción.') => {
  return error(res, mensaje, 403);
};

export const noEncontrado = (res: Response, mensaje = 'Recurso no encontrado.') => {
  return error(res, mensaje, 404);
};

export const errorServidor = (res: Response, mensaje = 'Error interno del servidor.') => {
  return error(res, mensaje, 500);
};
