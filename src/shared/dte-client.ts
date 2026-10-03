import axios from 'axios';
import { env } from './config/env.js';
import { query } from './config/database.js';
import { logger } from './utils/logger.js';
import { desencriptarTexto } from './utils/crypto.js';

export const crearClienteDte = (baseURL: string, apiKey: string, tenantId?: string) => {
  const cliente = axios.create({
    baseURL,
    timeout: env.DTE_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
    },
  });

  configurarInterceptores(cliente, baseURL);

  return cliente;
};

/**
 * Cliente servidor-a-servidor para las rutas internas del DTE Service
 * (/internal/provisioning/*). Usa la clave interna (DTE_INTERNAL_API_KEY),
 * DISTINTA de la API Key técnica del tenant (Fase 2, spec §8).
 */
export const crearClienteInternoDte = (baseURL: string) => {
  const cliente = axios.create({
    baseURL,
    timeout: env.DTE_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      ...(env.DTE_INTERNAL_API_KEY ? { 'X-Internal-Api-Key': env.DTE_INTERNAL_API_KEY } : {}),
    },
  });

  configurarInterceptores(cliente, baseURL);

  return cliente;
};

const configurarInterceptores = (cliente: ReturnType<typeof axios.create>, baseURL: string) => {
  cliente.interceptors.response.use(
    (response) => {
      const payload = response.data as unknown;
      const data = payload && typeof payload === 'object' && 'data' in payload
        ? (payload as { data: unknown }).data
        : payload;
      // Axios models the interceptor as returning AxiosResponse, but this
      // client deliberately exposes the API payload to feature services.
      return data as never;
    },
    (error) => {
      if (error.response) {
        const mensaje = error.response.data?.mensaje || `DTE Service error: ${error.response.status}`;
        const detalles = error.response.data?.detalles;
        logger.error('DTE Service respondió con error', { status: error.response.status, mensaje, ruta: error.config?.url });
        throw { status: error.response.status, mensaje, detalles };
      }
      if (error.code === 'ECONNREFUSED') {
        logger.error('DTE Service no disponible', { url: baseURL });
        throw { status: 503, mensaje: 'El servicio de facturación electrónica no está disponible.' };
      }
      if (error.code === 'ECONNABORTED') {
        logger.error('DTE Service timeout', { url: baseURL, timeout: env.DTE_TIMEOUT });
        throw { status: 504, mensaje: 'El servicio de facturación electrónica no respondió a tiempo.' };
      }
      logger.error('Error de conexión con DTE Service', { error: error.message });
      throw { status: 502, mensaje: 'Error de conexión con el servicio de facturación electrónica.' };
    }
  );
};

type TenantDteConfig = {
  dte_service_url: string | null;
  dte_api_key: string | null;
  dte_api_key_enc: string | null;
};

export const obtenerClientePorTenant = async (tenantId: string) => {
  const { rows } = await query(
    'SELECT dte_service_url, dte_api_key, dte_api_key_enc FROM tenants WHERE id = $1',
    [tenantId]
  );

  const tenant = rows[0] as TenantDteConfig | undefined;
  const baseURL = tenant?.dte_service_url || env.DTE_SERVICE_URL;

  // Fase 2 — Aislamiento multi-tenant:
  // En producción NO existe fallback global de API Key. Cada tenant debe
  // tener su propia clave para operar el DTE Service. En desarrollo se
  // permite la clave global para facilitar el flujo local.
  //
  // Fase 1 — Almacenamiento seguro: la API Key se persiste cifrada en
  // tenants.dte_api_key_enc (AES-256-GCM). Se descifra solo en runtime.
  // El texto plano en dte_api_key es legado de transición: en producción se
  // rechaza para forzar la migración (scripts/cifrar-api-keys.ts).
  let apiKey: string | null = null;
  if (tenant?.dte_api_key_enc) {
    try {
      apiKey = desencriptarTexto(tenant.dte_api_key_enc, env.POS_ENCRYPTION_KEY);
    } catch (err) {
      logger.error('No se pudo descifrar la API Key DTE del tenant', {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw { status: 500, mensaje: 'Error de configuración de la API Key de facturación.' };
    }
  } else if (tenant?.dte_api_key) {
    if (env.ES_PRODUCCION) {
      logger.error('Tenant con API Key DTE sin cifrar en producción', { tenantId });
      throw { status: 500, mensaje: 'API Key de facturación no migrada a cifrado seguro.' };
    }
    logger.warn('Tenant con API Key DTE en texto plano (legado) — ejecuta cifrar:api-keys', { tenantId });
    apiKey = tenant.dte_api_key;
  }

  if (!apiKey) {
    if (env.ES_PRODUCCION) {
      logger.error('Tenant sin API Key DTE configurada en producción', { tenantId });
      throw { status: 500, mensaje: 'Tenant sin API Key de facturación configurada.' };
    }
    apiKey = env.DTE_API_KEY;
  }

  return crearClienteDte(baseURL, apiKey, tenantId);
};
