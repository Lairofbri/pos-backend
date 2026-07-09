import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { noAutenticado } from '../utils/response.js';

export const autenticar = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return noAutenticado(res);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & {
      sub: string;
      tenant_id: string;
      rol: string;
      nombre: string;
      email: string;
      sucursal_id?: string;
    };

    req.usuario = {
      id: decoded.sub,
      tenant_id: decoded.tenant_id,
      rol: decoded.rol,
      nombre: decoded.nombre,
      email: decoded.email,
      sucursal_id: decoded.sucursal_id ?? '',
    };

    next();
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      return noAutenticado(res, 'Sesión expirada. Por favor inicia sesión nuevamente.');
    }
    return noAutenticado(res, 'Token inválido.');
  }
};
