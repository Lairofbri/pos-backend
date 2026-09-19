// Fase 3 — Idempotencia y consistencia fiscal DTE.
// Helpers compartidos entre el flujo síncrono (emitir) y el cron.

// Estados fiscales explícitos del DTE en el POS.
// Los estados del dte-service (generado/firmado/transmitido) se normalizan
// al vocabulario fiscal del POS.
export const ESTADOS_FISCALES: Record<string, string> = {
  aceptado: 'aceptado',
  rechazado: 'rechazado',
  contingencia: 'contingencia',
  anulado: 'anulado',
  generado: 'enviado',
  firmado: 'enviado',
  transmitido: 'enviado',
};

export const mapearEstadoFiscal = (estado?: string): string =>
  ESTADOS_FISCALES[estado || ''] || 'pendiente';

// El dte-service responde { ok, data }. El interceptor HTTP devuelve
// response.data, así que extraemos el objeto DTE real de `data`.
export const extraerResultado = (resp: unknown): Record<string, unknown> => {
  const body = resp as { data?: unknown };
  if (body && typeof body === 'object' && body.data && typeof body.data === 'object') {
    const datos = body.data as Record<string, unknown>;
    if ('codigo_generacion' in datos || 'estado' in datos || 'numero_control' in datos) {
      return datos;
    }
  }
  return body as unknown as Record<string, unknown>;
};