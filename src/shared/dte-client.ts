import axios from 'axios';
import { env } from './config/env.js';
import { query } from './config/database.js';
import { logger } from './utils/logger.js';

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

  return cliente;
};

type TenantDteConfig = {
  dte_service_url: string | null;
  dte_api_key: string | null;
};

export const obtenerClientePorTenant = async (tenantId: string) => {
  const { rows } = await query(
    'SELECT dte_service_url, dte_api_key FROM tenants WHERE id = $1',
    [tenantId]
  );

  const tenant = rows[0] as TenantDteConfig | undefined;
  const baseURL = tenant?.dte_service_url || env.DTE_SERVICE_URL;

  // Fase 2 — Aislamiento multi-tenant:
  // En producción NO existe fallback global de API Key. Cada tenant debe
  // tener su propia clave para operar el DTE Service. En desarrollo se
  // permite la clave global para facilitar el flujo local.
  let apiKey = tenant?.dte_api_key || null;
  if (!apiKey) {
    if (env.ES_PRODUCCION) {
      logger.error('Tenant sin API Key DTE configurada en producción', { tenantId });
      throw { status: 500, mensaje: 'Tenant sin API Key de facturación configurada.' };
    }
    apiKey = env.DTE_API_KEY;
  }

  return crearClienteDte(baseURL, apiKey, tenantId);
};
