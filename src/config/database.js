// src/config/database.js
// Pool de conexiones a PostgreSQL
// Usa pg con connection pooling para manejar múltiples requests simultáneos

const { Pool } = require('pg');
const { DATABASE_URL, ES_PRODUCCION } = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: DATABASE_URL,
  // En producción (Railway), siempre SSL
  ssl: ES_PRODUCCION ? { rejectUnauthorized: false } : false,
  // Pool de conexiones: máximo 20 clientes simultáneos
  max: 20,
  // Tiempo máximo esperando una conexión libre: 30 segundos
  connectionTimeoutMillis: 30000,
  // Tiempo máximo que una conexión puede estar inactiva: 10 minutos
  idleTimeoutMillis: 600000,
});

// Evento: conexión nueva establecida
pool.on('connect', () => {
  logger.debug('Nueva conexión establecida al pool de PostgreSQL');
});

// Evento: error en una conexión inactiva del pool
pool.on('error', (err) => {
  logger.error('Error inesperado en cliente del pool de PostgreSQL', { error: err.message });
});

// Función de conveniencia para ejecutar queries simples
const query = (text, params) => pool.query(text, params);

// Función para obtener un cliente del pool (útil para transacciones)
const getClient = () => pool.connect();

// Verifica que la conexión funciona al iniciar
const verificarConexion = async () => {
  try {
    const resultado = await query('SELECT NOW() as ahora');
    logger.info('Conexión a PostgreSQL exitosa', {
      servidor: resultado.rows[0].ahora,
    });
  } catch (error) {
    logger.error('Error al conectar con PostgreSQL', { error: error.message });
    process.exit(1); // Si no hay BD, no tiene sentido seguir
  }
};

module.exports = { pool, query, getClient, verificarConexion };
