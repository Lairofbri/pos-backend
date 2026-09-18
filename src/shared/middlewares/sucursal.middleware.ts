import type { Request, Response, NextFunction } from 'express';
import { esUuidValido } from './uuid.middleware.js';
import { query } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * Fase 2 — Aislamiento multi-tenant:
 * Resuelve la sucursal del request pero SIEMPRE validando que pertenezca
 * al tenant autenticado. El header X-Sucursal-Id por sí solo no se acepta:
 * si no pertenece al tenant se ignora y se cae al valor del JWT.
 */
export const resolverSucursal = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    let sucursalId: string | undefined;

    const headerSucursal = req.headers['x-sucursal-id'] as string | undefined;
    const tenantId = req.usuario?.tenant_id;

    if (headerSucursal && esUuidValido(headerSucursal)) {
      if (tenantId) {
        // La sucursal del header debe pertenecer al tenant autenticado.
        const { rows } = await query(
          'SELECT id FROM sucursales WHERE id = $1 AND tenant_id = $2 AND activo = TRUE',
          [headerSucursal, tenantId]
        );
        if (rows.length > 0) {
          sucursalId = headerSucursal;
        } else {
          logger.warn('X-Sucursal-Id no pertenece al tenant — ignorado', {
            sucursal: headerSucursal,
            tenant_id: tenantId,
            ip: req.ip,
          });
        }
      }
    }

    if (!sucursalId && req.usuario?.sucursal_id && esUuidValido(req.usuario.sucursal_id)) {
      sucursalId = req.usuario.sucursal_id;
    }

    req.sucursalId = sucursalId;
    next();
  } catch (err) {
    logger.error('Error al resolver sucursal', { error: (err as Error).message });
    next();
  }
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
