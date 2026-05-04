// src/utils/logger.js
// Logger centralizado usando Winston
// En desarrollo: logs coloridos en consola
// En producción: logs JSON estructurados (Railway los captura automáticamente)

const winston = require('winston');
const { LOG_LEVEL, ES_PRODUCCION } = require('../config/env');

const formatoDesarrollo = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${extras}`;
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

module.exports = logger;
