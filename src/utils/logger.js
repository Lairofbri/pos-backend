// src/utils/logger.js
// Logger centralizado usando Winston
// En desarrollo: logs coloridos en consola
// En producción: logs JSON estructurados (Railway los captura automáticamente)
// Cada log incluye requestId automáticamente vía AsyncLocalStorage

const winston = require('winston');
const { LOG_LEVEL, ES_PRODUCCION } = require('../config/env');
const { getStore } = require('./requestId');

const formatoDesarrollo = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Mostrar requestId primero si existe
    const reqId = meta.requestId ? ` [${meta.requestId.slice(0, 8)}]` : '';
    const extras = Object.keys(meta).filter(k => k !== 'requestId').length
      ? ` ${JSON.stringify(Object.fromEntries(Object.entries(meta).filter(([k]) => k !== 'requestId')))}`
      : '';
    return `${timestamp}${reqId} [${level}]: ${message}${extras}`;
  })
);

const formatoProduccion = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: ES_PRODUCCION ? formatoProduccion : formatoDesarrollo,
  transports: [new winston.transports.Console()],
});

// Envolver métodos para inyectar requestId automáticamente desde AsyncLocalStorage
// Sin cambiar la API de logging — los módulos siguen llamando logger.info(...) igual que antes
['error', 'warn', 'info', 'debug'].forEach((level) => {
  const original = logger[level];
  logger[level] = function (message, meta = {}) {
    const ctx = getStore();
    if (ctx?.requestId && typeof meta === 'object') {
      return original.call(this, message, { ...meta, requestId: ctx.requestId });
    }
    if (ctx?.requestId) {
      return original.call(this, message, meta);
    }
    return original.call(this, message, meta);
  };
});

module.exports = logger;
