import { env } from './config/env.js';
import { crearClienteInternoDte, crearClientePublicoDte } from './dte-client.js';
import { logger } from './utils/logger.js';

/**
 * F3 — Lectura de EMPRESA y SUCURSAL desde el DTE Service (spec «DTE única
 * fuente de verdad de empresa y sucursal», 2026-10-16).
 *
 * El DTE es la única fuente de verdad de la empresa (identidad fiscal +
 * configuración) y de las sucursales (establecimientos). El POS NO guarda ni
 * administra esos datos: los consume server-a-servidor por las rutas internas
 * del DTE (`GET /internal/provisioning/tenants/:id/empresa`, clave
 * `X-Internal-Api-Key`) y públicas (`GET /api/tenants`).
 *
 * Este módulo centraliza:
 * - El contrato de lectura (`EmpresaDte` / `EstablecimientoDte`).
 * - El mapeo a la forma que ya consume el POS (sucursal / empresa del login).
 * - Una caché en memoria corta y ADITIVA (no es fuente de verdad): si el DTE
 *   no responde se sirve la última copia buena (degradación §7.8). Si no hay
 *   copia previa, el error se propaga.
 *
 * NUNCA expone secretos: el contrato del DTE solo trae booleanos de
 * "configurada" para credenciales/firma.
 */

/** Cliente HTTP mínimo contra el DTE Service (el interceptor ya desenvuelve `data`). */
export type ClienteDteGet = { get: (url: string) => Promise<unknown> };
export type FabricaClienteDte = (baseURL: string) => ClienteDteGet;

/** Campos mínimos para elegir el establecimiento predeterminado de un tenant. */
export type EstablecimientoElegible = {
  id: string;
  es_principal?: boolean;
  activo?: boolean;
  fiscal_status?: string;
};

/**
 * F5 — establecimiento PREDETERMINADO del tenant.
 *
 * El POS necesita un contexto de sucursal canónico incluso cuando el usuario no
 * tiene una asignada (los administradores del onboarding nacen con
 * `sucursal_id = NULL`) o cuando la orden histórica quedó sin sucursal. La
 * elección es determinista y siempre sale del DTE:
 *
 * 1. la matriz (`es_principal`) con vínculo fiscal `ready` y activa;
 * 2. cualquier establecimiento `ready` y activo;
 * 3. la matriz activa;
 * 4. cualquier activo;
 * 5. la matriz; 6. el primero.
 *
 * Devuelve `null` si el tenant no tiene establecimientos.
 */
export const elegirEstablecimientoPredeterminado = <T extends EstablecimientoElegible>(
  establecimientos: T[]
): T | null => {
  if (!Array.isArray(establecimientos) || establecimientos.length === 0) return null;

  const activo = (e: T) => !!e.activo;
  const principal = (e: T) => !!e.es_principal;
  const listo = (e: T) => e.fiscal_status === 'ready';

  return (
    establecimientos.find((e) => principal(e) && activo(e) && listo(e)) ??
    establecimientos.find((e) => activo(e) && listo(e)) ??
    establecimientos.find((e) => principal(e) && activo(e)) ??
    establecimientos.find(activo) ??
    establecimientos.find(principal) ??
    establecimientos[0] ??
    null
  );
};

export type TenantEmpresaDte = {
  id: string;
  nombre: string;
  nombre_comercial: string | null;
  nit: string | null;
  nrc: string | null;
  activo: boolean;
  provisioning_status: string;
  tiene_pos: boolean;
};

export type ConfiguracionEmpresaDte = {
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  codigo_actividad: string | null;
  desc_actividad: string | null;
  ambiente: string | null;
  tiene_credenciales_hacienda: boolean;
  password_firma_configurada: boolean;
};

export type EstablecimientoDte = {
  id: string;
  branch_id: string | null;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  es_principal: boolean;
  activo: boolean;
  cod_estable_mh: string | null;
  cod_punto_venta_mh: string | null;
  cod_estable: string | null;
  cod_punto_venta: string | null;
  tipo_establecimiento: string | null;
  departamento_cod: string | null;
  municipio_cod: string | null;
  distrito_cod: string | null;
  fiscal_status: string;
  provisioning_status: string | null;
};

export type EmpresaDte = {
  tenant: TenantEmpresaDte;
  configuracion: ConfiguracionEmpresaDte | null;
  establecimientos: EstablecimientoDte[];
};

/** Respuesta pública de `GET /api/tenants` (selector de empresa del login). */
export type TenantListadoDte = {
  id: string;
  nombre: string;
  nombre_comercial: string | null;
  provisioning_status: string;
};

/** Sucursal en la forma que ya consumía el POS (proxy del establecimiento DTE). */
export type SucursalEmpresa = {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  dte_establecimiento_id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  es_principal: boolean;
  activo: boolean;
  fiscal_status: string;
  sync_error: string | null;
  last_fiscal_sync_at: string | null;
  creado_en: string | null;
  cod_estable_mh: string | null;
  cod_punto_venta_mh: string | null;
  tipo_establecimiento: string | null;
  departamento_cod: string | null;
  municipio_cod: string | null;
  distrito_cod: string | null;
};

/** Datos de EMPRESA para la cabecera fiscal de los tickets (sin secretos). */
export type DatosEmisorDte = {
  id: string;
  nombre: string | null;
  nombre_comercial: string | null;
  nit: string | null;
  nrc: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  logo_url: string | null;
};

/** Contexto fiscal mínimo para emitir/anular (establecimiento resuelto). */
export type ContextoFiscalEstablecimiento = {
  id: string;
  branch_id: string | null;
  dte_establecimiento_id: string;
  fiscal_status: string;
  activo: boolean;
  nombre: string;
};

const mensajeError = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'mensaje' in err) {
    return String((err as { mensaje?: unknown }).mensaje);
  }
  return String(err);
};

export const crearServicioEmpresaDte = (
  dependencias: {
    crearClienteInterno?: FabricaClienteDte;
    crearClientePublico?: FabricaClienteDte;
    baseURL?: string;
    ttlMs?: number;
    ahora?: () => number;
  } = {}
) => {
  const crearClienteInterno: FabricaClienteDte =
    dependencias.crearClienteInterno ?? (crearClienteInternoDte as FabricaClienteDte);
  const crearClientePublico: FabricaClienteDte =
    dependencias.crearClientePublico ?? (crearClientePublicoDte as FabricaClienteDte);
  const baseURL = dependencias.baseURL ?? env.DTE_SERVICE_URL;
  const ttlMs = dependencias.ttlMs ?? env.EMPRESA_DTE_CACHE_TTL_MS;
  const ahora = dependencias.ahora ?? Date.now;

  const cache = new Map<string, { valor: EmpresaDte; expiraEn: number }>();

  const normalizarId = (tenantId: string) => String(tenantId).toLowerCase();

  const listarEstablecimientosCrudo = (empresa: EmpresaDte): EstablecimientoDte[] =>
    Array.isArray(empresa?.establecimientos) ? empresa.establecimientos : [];

  /**
   * Ficha de empresa (identidad + configuración + establecimientos) del DTE.
   * Cacheada; si el DTE falla se sirve la última copia buena (degradación).
   */
  const obtenerEmpresa = async (
    tenantId: string,
    opciones: { refrescar?: boolean } = {}
  ): Promise<EmpresaDte> => {
    const clave = normalizarId(tenantId);
    const enCache = cache.get(clave);
    const vigente = !!enCache && enCache.expiraEn > ahora();

    if (!opciones.refrescar && vigente && enCache) return enCache.valor;

    try {
      const cliente = crearClienteInterno(baseURL);
      const empresa = (await cliente.get(
        `/internal/provisioning/tenants/${clave}/empresa`
      )) as EmpresaDte;
      cache.set(clave, { valor: empresa, expiraEn: ahora() + ttlMs });
      return empresa;
    } catch (err) {
      if (enCache) {
        logger.warn('DTE no disponible — sirviendo empresa desde la caché (degradación)', {
          tenant_id: clave,
          error: mensajeError(err),
        });
        return enCache.valor;
      }
      throw err;
    }
  };

  /** Lista pública de empresas (`GET /api/tenants`) para el selector del login. */
  const listarTenants = async (): Promise<TenantListadoDte[]> => {
    const cliente = crearClientePublico(baseURL);
    const respuesta = await cliente.get('/api/tenants');
    if (!Array.isArray(respuesta)) return [];
    return respuesta as TenantListadoDte[];
  };

  const mapearSucursal = (tenantId: string, e: EstablecimientoDte): SucursalEmpresa => ({
    id: e.id,
    tenant_id: tenantId,
    branch_id: e.branch_id ?? null,
    dte_establecimiento_id: e.id,
    nombre: e.nombre,
    direccion: e.direccion ?? null,
    telefono: e.telefono ?? null,
    email: e.email ?? null,
    es_principal: !!e.es_principal,
    activo: !!e.activo,
    fiscal_status: e.fiscal_status,
    sync_error: null,
    last_fiscal_sync_at: null,
    creado_en: null,
    cod_estable_mh: e.cod_estable_mh ?? null,
    cod_punto_venta_mh: e.cod_punto_venta_mh ?? null,
    tipo_establecimiento: e.tipo_establecimiento ?? null,
    departamento_cod: e.departamento_cod ?? null,
    municipio_cod: e.municipio_cod ?? null,
    distrito_cod: e.distrito_cod ?? null,
  });

  const ordenarEstablecimientos = (lista: EstablecimientoDte[]): EstablecimientoDte[] =>
    [...lista].sort(
      (a, b) => Number(!!b.es_principal) - Number(!!a.es_principal) || a.nombre.localeCompare(b.nombre)
    );

  /** Sucursales (establecimientos) del tenant, en la forma que consume el POS. */
  const listarEstablecimientos = async (tenantId: string): Promise<SucursalEmpresa[]> => {
    const empresa = await obtenerEmpresa(tenantId);
    const tenant = empresa.tenant?.id ?? normalizarId(tenantId);
    return ordenarEstablecimientos(listarEstablecimientosCrudo(empresa)).map((e) =>
      mapearSucursal(tenant, e)
    );
  };

  const obtenerEstablecimiento = async (
    tenantId: string,
    establecimientoId: string
  ): Promise<SucursalEmpresa> => {
    const empresa = await obtenerEmpresa(tenantId);
    const tenant = empresa.tenant?.id ?? normalizarId(tenantId);
    const est = listarEstablecimientosCrudo(empresa).find((e) => e.id === establecimientoId);
    if (!est) throw { status: 404, mensaje: 'Sucursal no encontrada.' };
    return mapearSucursal(tenant, est);
  };

  /**
   * Resuelve el establecimiento del DTE por su id canónico o su `branch_id`
   * (el POS histórico guarda el `branch_id` en `sucursal_id`). Devuelve null si
   * no pertenece al tenant (aislamiento).
   */
  const resolverEstablecimientoFiscal = async (
    tenantId: string,
    referencia: string
  ): Promise<ContextoFiscalEstablecimiento | null> => {
    const empresa = await obtenerEmpresa(tenantId);
    const est = listarEstablecimientosCrudo(empresa).find(
      (e) => e.id === referencia || e.branch_id === referencia
    );
    if (!est) return null;
    return {
      id: est.id,
      branch_id: est.branch_id ?? null,
      dte_establecimiento_id: est.id,
      fiscal_status: est.fiscal_status,
      activo: !!est.activo,
      nombre: est.nombre,
    };
  };

  /**
   * F5 — establecimiento PREDETERMINADO del tenant resuelto contra el DTE.
   *
   * Garantiza un contexto de sucursal canónico para el POS cuando el usuario no
   * tiene una asignada (`sucursal_id = NULL`, caso de los administradores del
   * onboarding) o cuando la operación histórica quedó sin sucursal. Nunca
   * inventa ids: si el tenant no tiene establecimientos devuelve `null`.
   */
  const resolverEstablecimientoFiscalPredeterminado = async (
    tenantId: string
  ): Promise<ContextoFiscalEstablecimiento | null> => {
    const empresa = await obtenerEmpresa(tenantId);
    const est = elegirEstablecimientoPredeterminado(listarEstablecimientosCrudo(empresa));
    if (!est) return null;
    return {
      id: est.id,
      branch_id: est.branch_id ?? null,
      dte_establecimiento_id: est.id,
      fiscal_status: est.fiscal_status,
      activo: !!est.activo,
      nombre: est.nombre,
    };
  };

  /** Empresas + sucursales para el login (`GET /api/v1/empresas`), sin CORS. */
  const listarEmpresasParaLogin = async (): Promise<{
    tenants: Array<{
      id: string;
      nombre: string;
      nombre_comercial: string | null;
      logo_url: string | null;
      fiscal_sync_status: string;
    }>;
    sucursales: SucursalEmpresa[];
  }> => {
    const tenants = await listarTenants();

    const porTenant = await Promise.all(
      tenants.map(async (t) => {
        try {
          const empresa = await obtenerEmpresa(t.id);
          const idTenant = empresa.tenant?.id ?? t.id;
          return listarEstablecimientosCrudo(empresa).map((e) => mapearSucursal(idTenant, e));
        } catch (err) {
          logger.warn('No se pudieron obtener las sucursales de una empresa para el login', {
            tenant_id: t.id,
            error: mensajeError(err),
          });
          return [] as SucursalEmpresa[];
        }
      })
    );

    const sucursales = porTenant
      .flat()
      .sort(
        (a, b) => Number(b.es_principal) - Number(a.es_principal) || a.nombre.localeCompare(b.nombre)
      );

    return {
      tenants: tenants.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        nombre_comercial: t.nombre_comercial ?? t.nombre,
        // El DTE aún no expone logo/plan (decisiones §7.1–§7.2 → F6).
        logo_url: null,
        fiscal_sync_status: t.provisioning_status || 'pending_fiscal_setup',
      })),
      sucursales,
    };
  };

  /** Identidad de EMPRESA para la cabecera fiscal de los tickets (sin secretos). */
  const obtenerDatosEmisor = async (tenantId: string): Promise<DatosEmisorDte> => {
    const empresa = await obtenerEmpresa(tenantId);
    const cfg = empresa.configuracion ?? null;
    return {
      id: empresa.tenant?.id ?? normalizarId(tenantId),
      nombre: empresa.tenant?.nombre ?? null,
      nombre_comercial: empresa.tenant?.nombre_comercial ?? null,
      nit: empresa.tenant?.nit ?? null,
      nrc: empresa.tenant?.nrc ?? null,
      direccion: cfg?.direccion ?? null,
      telefono: cfg?.telefono ?? null,
      email: cfg?.email ?? null,
      logo_url: null,
    };
  };

  /**
   * Mapa `establecimiento_id`/`branch_id` → nombre, para enriquecer las vistas
   * operativas del POS (inventario) sin leer la tabla local `sucursales`.
   */
  const mapaNombresEstablecimiento = async (tenantId: string): Promise<Map<string, string>> => {
    const empresa = await obtenerEmpresa(tenantId);
    const mapa = new Map<string, string>();
    for (const e of listarEstablecimientosCrudo(empresa)) {
      if (e.id) mapa.set(e.id, e.nombre);
      if (e.branch_id) mapa.set(e.branch_id, e.nombre);
    }
    return mapa;
  };

  /** Invalida la caché (tests o tras un cambio de empresa en el DTE). */
  const invalidarCache = (tenantId?: string) => {
    if (tenantId) cache.delete(normalizarId(tenantId));
    else cache.clear();
  };

  return {
    obtenerEmpresa,
    listarTenants,
    listarEstablecimientos,
    obtenerEstablecimiento,
    resolverEstablecimientoFiscal,
    resolverEstablecimientoFiscalPredeterminado,
    listarEmpresasParaLogin,
    obtenerDatosEmisor,
    mapaNombresEstablecimiento,
    invalidarCache,
  };
};

// Instancia por defecto (uso normal) + factory para unit tests.
export const servicioEmpresaDte = crearServicioEmpresaDte();
export const crearServicioEmpresaDteFactory = crearServicioEmpresaDte;
