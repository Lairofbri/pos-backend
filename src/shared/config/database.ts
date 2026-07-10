import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.ES_PRODUCCION ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED } : false,
  max: 20,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 600000,
});

pool.on('connect', () => {
  logger.debug('Nueva conexión establecida al pool de PostgreSQL');
});

pool.on('error', (err: Error) => {
  logger.error('Error inesperado en cliente del pool de PostgreSQL', { error: err.message });
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);

export const getClient = () => pool.connect();

export const verificarConexion = async () => {
  try {
    const resultado = await query('SELECT NOW() as ahora');
    logger.info('Conexión a PostgreSQL exitosa', {
      servidor: (resultado.rows[0] as { ahora: Date }).ahora,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Error al conectar con PostgreSQL', { error: message });
    process.exit(1);
  }
};

export { pool };
