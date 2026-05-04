// src/config/env.js
// Carga y valida todas las variables de entorno al arrancar
// Si falta alguna crítica, el servidor NO arranca (fail-fast)

require('dotenv').config();

const requerida = (nombre) => {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Variable de entorno requerida no definida: ${nombre}`);
  }
  return valor;
};

const opcionalInt = (nombre, porDefecto) => {
  const valor = process.env[nombre];
  return valor ? parseInt(valor, 10) : porDefecto;
};

module.exports = {
  // Servidor
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: opcionalInt('PORT', 3000),
  ES_PRODUCCION: process.env.NODE_ENV === 'production',

  // Base de datos
  DATABASE_URL: requerida('DATABASE_URL'),

  // JWT
  JWT_SECRET: requerida('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  JWT_REFRESH_SECRET: requerida('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // CORS
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim()),

  // Logs
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
