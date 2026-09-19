import winston from 'winston';
import { env } from '../config/env.js';
import { getStore } from './requestId.js';

const CAMPOS_SENSIBLES = new Set([
  'password',
  'passwordpri',
  'password_pri',
  'password_hacienda',
  'usuario_hacienda',
  'api_key',
  'apikey',
  'x-api-key',
  'encryption_key',
  'token',
  'refresh_token',
  'authorization',
  'cookie',
  'json_firmado',
  'pwd',
]);

const PARECE_JWT = /^eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;

const redactar = (valor: unknown): unknown => {
  if (valor === null || typeof valor !== 'object') {
    if (typeof valor === 'string' && PARECE_JWT.test(valor.trim())) {
      return '[REDACTADO-JWT]';
    }
    return valor;
  }

  if (Array.isArray(valor)) {
    return valor.map(redactar);
  }

  const objeto = valor as Record<string, unknown>;
  const limpio: Record<string, unknown> = {};
  for (const [clave, subValor] of Object.entries(objeto)) {
    if (CAMPOS_SENSIBLES.has(clave.toLowerCase())) {
      limpio[clave] = '[REDACTADO]';
    } else {
      limpio[clave] = redactar(subValor);
    }
  }
  return limpio;
};

const formatoDesarrollo = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaRecord = meta as Record<string, unknown>;
    const reqId = metaRecord.requestId ? ` [${String(metaRecord.requestId).slice(0, 8)}]` : '';
    const extras = Object.keys(metaRecord).filter(k => k !== 'requestId').length
      ? ` ${JSON.stringify(Object.fromEntries(Object.entries(metaRecord).filter(([k]) => k !== 'requestId')))}`
      : '';
    return `${timestamp as string}${reqId} [${level}]: ${String(message)}${extras}`;
  })
);

const formatoProduccion = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.ES_PRODUCCION ? formatoProduccion : formatoDesarrollo,
  transports: [new winston.transports.Console()],
});

['error', 'warn', 'info', 'debug'].forEach((level) => {
  const l = logger as unknown as Record<string, unknown>;
  const original = l[level] as (...args: unknown[]) => winston.Logger;
  l[level] = function (this: winston.Logger, message: string, meta: Record<string, unknown> = {}) {
    const ctx = getStore();
    const metaSeguro = redactar(meta) as Record<string, unknown>;
    if (ctx?.requestId) {
      return original.call(this, message, { ...metaSeguro, requestId: ctx.requestId });
    }
    return original.call(this, message, metaSeguro);
  };
});

export { logger };
