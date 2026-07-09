import type { Request, Response, NextFunction } from 'express';
import { error } from '../utils/response.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const esUuidValido = (valor: unknown): boolean => {
  if (!valor || typeof valor !== 'string') return false;
  return UUID_REGEX.test(valor);
};

export const validarUuidParam = (param = 'id', nombreLegible: string | null = null) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const valor = req.params[param];
    const nombre = nombreLegible || param;

    if (!esUuidValido(valor)) {
      return error(res, `El parámetro ${nombre} no tiene un formato UUID válido.`, 400);
    }
    next();
  };
};

export const validarUuidQuery = (res: Response, valor: string | undefined, nombre: string): boolean => {
  if (valor && !esUuidValido(valor)) {
    error(res, `El parámetro ${nombre} no tiene un formato UUID válido.`, 400);
    return false;
  }
  return true;
};
