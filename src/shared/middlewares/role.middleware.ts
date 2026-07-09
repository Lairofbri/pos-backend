import type { Request, Response, NextFunction } from 'express';
import { sinPermiso } from '../utils/response.js';

export const requiereRol = (...rolesPermitidos: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.usuario) {
      return sinPermiso(res, 'No autenticado.');
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return sinPermiso(
        res,
        `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}.`
      );
    }

    next();
  };
};

export const soloAdmin = requiereRol('administrador');
export const adminOCajero = requiereRol('administrador', 'cajero');
export const todosLosRoles = requiereRol('administrador', 'cajero', 'mesero');
