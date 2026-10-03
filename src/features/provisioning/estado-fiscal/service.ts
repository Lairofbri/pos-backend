import { env } from '../../../shared/config/env.js';
import { crearClienteInternoDte } from '../../../shared/dte-client.js';

/**
 * Consulta del estado fiscal de la integración POS ↔ DTE (Fase 4).
 *
 * El POS consulta a demanda el estado fiscal al DTE Service (fuente de
 * verdad fiscal) mediante el endpoint interno de LECTURA:
 *   GET /internal/provisioning/tenants/:tenantId/estado-fiscal
 *
 * REGLA CRÍTICA (spec §10 Fase 4 — criterio de salida):
 *   "POS puede consultar estado fiscal, pero nunca leer ni modificar
 *    secretos Hacienda."
 * La respuesta del DTE contiene SOLO señales operativas (booleanos,
 * estados y fiscal_status) — NUNCA usuario/password de Hacienda, tokens
 * ni secretos de firma. Este servicio no persiste nada: es consulta pura.
 *
 * TESTABILIDAD: factory con dependencias inyectables.
 */

export type EstadoFirmaDte = {
  tenant_id: string | null;
  nit: string | null;
  estado: 'listo' | 'firmador_offline' | 'sin_credencial' | string;
  firmador_disponible: boolean;
  credencial_firma_disponible: boolean;
};

export type EstablecimientoFiscal = {
  establecimiento_id: string;
  branch_id: string | null;
  fiscal_status: string;
  activo: boolean;
};

export type EstadoFiscalDte = {
  tenant_id: string;
  provisioning_status: string;
  credenciales_hacienda: boolean;
  token_vigente: boolean;
  firma: EstadoFirmaDte;
  establecimientos: EstablecimientoFiscal[];
};

const crearServicioEstadoFiscal = (dependencias: {
  crearClienteInterno?: typeof crearClienteInternoDte;
} = {}) => {
  const crearClienteInterno = dependencias.crearClienteInterno || crearClienteInternoDte;

  const consultarEstadoFiscal = async ({
    tenantId,
  }: {
    tenantId: string;
  }): Promise<EstadoFiscalDte> => {
    const cliente = crearClienteInterno(env.DTE_SERVICE_URL);
    const estado = (await cliente.get(
      `/internal/provisioning/tenants/${tenantId}/estado-fiscal`
    )) as unknown as EstadoFiscalDte;
    return estado;
  };

  return { consultarEstadoFiscal };
};

export const servicioEstadoFiscal = crearServicioEstadoFiscal();
export const crearServicioEstadoFiscalFactory = crearServicioEstadoFiscal;