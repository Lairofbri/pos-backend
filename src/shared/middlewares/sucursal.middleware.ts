import type { Request, Response, NextFunction } from 'express';
import { esUuidValido } from './uuid.middleware.js';
import { servicioEmpresaDte, elegirEstablecimientoPredeterminado } from '../dte-empresa.js';
import { logger } from '../utils/logger.js';

/**
 * Resolución de la sucursal del request (Fase 2 + F5).
 *
 * F5 (spec «DTE única fuente de verdad de empresa y sucursal», 2026-10-16): la
 * tabla local `sucursales` se retiró. El header `X-Sucursal-Id` es el
 * `establecimiento_id` canónico del DTE y se valida contra la ficha de empresa
 * del DTE (caché en memoria de `dte-empresa`). El aislamiento por tenant sigue
 * garantizado porque TODAS las queries operativas filtran por `tenant_id`.
 *
 * Orden de resolución:
 * 1. `X-Sucursal-Id` cuando es un establecimiento del tenant.
 * 2. `sucursal_id` del JWT cuando es un establecimiento del tenant (el POS
 *    histórico guardaba ids locales; tras la migración 081 ya es canónico).
 * 3. **Establecimiento PREDETERMINADO del tenant** (F5). Sin este paso una
 *    empresa recién creada desde el DTE quedaba sin contexto de sucursal —el
 *    administrador del onboarding nace con `sucursal_id = NULL`— y las órdenes
 *    se creaban sin sucursal, por lo que la emisión del DTE fallaba con 409
 *    «la orden no tiene una sucursal operativa».
 *
 * Degradación: si el DTE no responde se aceptan el header y el `sucursal_id`
 * del JWT sin validar (son la identidad canónica y no hay copia local que
 * validar); sin datos no se puede derivar el predeterminado.
 */
export type EstablecimientoDteListado = {
  id: string;
  es_principal?: boolean;
  activo?: boolean;
  fiscal_status?: string;
};

export type ListarEstablecimientosDte = (
  tenantId: string
) => Promise<EstablecimientoDteListado[]>;

export const crearResolverSucursal = (
  dependencias: { listarEstablecimientos?: ListarEstablecimientosDte } = {}
) => {
  const listarEstablecimientos =
    dependencias.listarEstablecimientos ??
    ((tenantId: string) => servicioEmpresaDte.listarEstablecimientos(tenantId));

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const tenantId = req.usuario?.tenant_id;
      const headerSucursal = req.headers['x-sucursal-id'] as string | undefined;

      // Una sola lectura de la ficha de empresa por request (cacheada por
      // tenant en `dte-empresa`, TTL `EMPRESA_DTE_CACHE_TTL_MS`).
      let establecimientos: EstablecimientoDteListado[] | null = null;
      if (tenantId) {
        try {
          establecimientos = await listarEstablecimientos(tenantId);
        } catch (err) {
          establecimientos = null;
          logger.warn('DTE no disponible — la sucursal se acepta sin validar', {
            tenant_id: tenantId,
            error: (err as Error).message,
          });
        }
      }

      // `null` = no se pudo consultar el DTE (degradación): se acepta lo que
      // venga por considerarse la identidad canónica.
      const esDelTenant = (id: string) =>
        establecimientos === null || establecimientos.some((e) => e.id === id);

      let sucursalId: string | undefined;

      if (headerSucursal && esUuidValido(headerSucursal)) {
        if (esDelTenant(headerSucursal)) {
          sucursalId = headerSucursal;
        } else {
          logger.warn('X-Sucursal-Id no es un establecimiento del tenant — ignorado', {
            sucursal: headerSucursal,
            tenant_id: tenantId,
            ip: req.ip,
          });
        }
      }

      const sucursalJwt = req.usuario?.sucursal_id;
      if (!sucursalId && sucursalJwt && esUuidValido(sucursalJwt)) {
        if (esDelTenant(sucursalJwt)) {
          sucursalId = sucursalJwt;
        } else {
          logger.warn('La sucursal del JWT no es un establecimiento del tenant — ignorada', {
            sucursal: sucursalJwt,
            tenant_id: tenantId,
          });
        }
      }

      // F5 — sin sucursal explícita se opera con el establecimiento
      // predeterminado del DTE (la matriz). Así toda orden nace con un
      // `establecimiento_id` canónico y la emisión del DTE no se bloquea.
      if (!sucursalId && establecimientos && establecimientos.length > 0) {
        const predeterminado = elegirEstablecimientoPredeterminado(establecimientos);
        if (predeterminado) {
          sucursalId = predeterminado.id;
          logger.info('Sucursal no indicada — usando el establecimiento predeterminado del DTE', {
            tenant_id: tenantId,
            sucursal: sucursalId,
            es_principal: !!predeterminado.es_principal,
          });
        }
      }

      req.sucursalId = sucursalId;
      next();
    } catch (err) {
      logger.error('Error al resolver sucursal', { error: (err as Error).message });
      next();
    }
  };
};

export const resolverSucursal = crearResolverSucursal();

export const requiereSucursal = (req: Request, res: Response, next: NextFunction) => {
  if (!req.sucursalId) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Header X-Sucursal-Id requerido para esta operación.',
    });
  }
  next();
};
