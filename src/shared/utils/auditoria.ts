import { logger } from './logger.js';

/**
 * Auditoría de escrituras bloqueadas sobre datos de EMPRESA (F2, 2026-10-16).
 *
 * El DTE Service es la única fuente de verdad de la empresa (identidad +
 * configuración fiscal) y de las sucursales/establecimientos. El POS conserva
 * las rutas solo para responder con un error explícito; cada intento queda
 * registrado como evento de seguridad (Winston nivel `warn`, JSON en
 * producción) con tenant, usuario, endpoint y campos intentados.
 *
 * Nunca se registran valores, solo nombres de campos: pueden contener datos
 * fiscales o personales.
 */

export const EVENTO_EMPRESA_BLOQUEADA = 'ESCRITURA_EMPRESA_BLOQUEADA';
export const EVENTO_SUCURSAL_BLOQUEADA = 'ESCRITURA_SUCURSAL_BLOQUEADA';

export type EventoEscrituraBloqueada =
  | typeof EVENTO_EMPRESA_BLOQUEADA
  | typeof EVENTO_SUCURSAL_BLOQUEADA;

export type IntentoEscrituraBloqueado = {
  evento: EventoEscrituraBloqueada;
  tenantId: string;
  usuarioId?: string | null;
  metodo: string;
  ruta: string;
  campos: string[];
  ip?: string | null;
};

export const registrarIntentoEscrituraBloqueado = ({
  evento,
  tenantId,
  usuarioId = null,
  metodo,
  ruta,
  campos,
  ip = null,
}: IntentoEscrituraBloqueado): void => {
  logger.warn('Intento de escritura de empresa/sucursal bloqueado (fuente de verdad: DTE)', {
    evento,
    tenant_id: tenantId,
    usuario_id: usuarioId,
    metodo,
    ruta,
    campos,
    ip,
  });
};
