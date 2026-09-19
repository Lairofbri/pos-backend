const CAMPOS_SECRETOS = new Set([
  'password_pri',
  'passwordPri',
  'password',
  'password_hacienda',
  'usuario_hacienda',
  'api_key',
  'apiKey',
  'encryption_key',
  'token',
  'pwd',
]);

export const limpiarPayloadSecreto = <T>(payload: T): T => {
  if (payload === null || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => limpiarPayloadSecreto(item)) as unknown as T;
  }

  const limpio: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(payload as Record<string, unknown>)) {
    if (CAMPOS_SECRETOS.has(clave)) continue;
    limpio[clave] = limpiarPayloadSecreto(valor);
  }
  return limpio as T;
};

export const tieneCamposSecretos = (payload: unknown): boolean => {
  if (payload === null || typeof payload !== 'object') return false;

  if (Array.isArray(payload)) {
    return payload.some((item) => tieneCamposSecretos(item));
  }

  for (const [clave, valor] of Object.entries(payload as Record<string, unknown>)) {
    if (CAMPOS_SECRETOS.has(clave)) return true;
    if (tieneCamposSecretos(valor)) return true;
  }
  return false;
};
