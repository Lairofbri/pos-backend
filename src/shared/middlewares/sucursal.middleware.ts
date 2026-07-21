import type { Request, Response, NextFunction } from 'express';
import { esUuidValido } from './uuid.middleware.js';

export const resolverSucursal = (req: Request, _res: Response, next: NextFunction) => {
  let sucursalId: string | undefined;

  const headerSucursal = req.headers['x-sucursal-id'] as string | undefined;

  if (headerSucursal && esUuidValido(headerSucursal)) {
    sucursalId = headerSucursal;
  } else if (req.usuario?.sucursal_id && esUuidValido(req.usuario.sucursal_id)) {
    sucursalId = req.usuario.sucursal_id;
  }

  req.sucursalId = sucursalId;
  next();
};

export const requiereSucursal = (req: Request, res: Response, next: NextFunction) => {
  if (!req.sucursalId) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Header X-Sucursal-Id requerido para esta operación.',
    });
  }
  next();
};
