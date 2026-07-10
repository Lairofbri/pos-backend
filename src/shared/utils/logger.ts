import winston from 'winston';
import { env } from '../config/env.js';
import { getStore } from './requestId.js';

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
    if (ctx?.requestId) {
      return original.call(this, message, { ...meta, requestId: ctx.requestId });
    }
    return original.call(this, message, meta);
  };
});

export { logger };
