// scripts/cifrar-api-keys.ts
// Backfill idempotente: mueve tenants.dte_api_key (texto plano) a
// tenants.dte_api_key_enc cifrada con AES-256-GCM y limpia el texto plano.
//
// Uso: pnpm cifrar:api-keys
//
// Solo procesa filas con dte_api_key no nulo y dte_api_key_enc nulo. Si se
// interrumpe a mitad de camino, volver a ejecutar continúa donde quedó.

import { pool } from '../src/shared/config/database.js';
import { env } from '../src/shared/config/env.js';
import { encriptarTexto } from '../src/shared/utils/crypto.js';
import { logger } from '../src/shared/utils/logger.js';

const run = async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, dte_api_key
       FROM tenants
       WHERE dte_api_key IS NOT NULL
         AND dte_api_key_enc IS NULL`
    );

    logger.info('API Keys DTE por cifrar', { cantidad: rows.length });

    for (const fila of rows as Array<{ id: string; dte_api_key: string }>) {
      const cifrado = encriptarTexto(fila.dte_api_key, env.POS_ENCRYPTION_KEY);
      if (!cifrado) continue;

      await client.query(
        `UPDATE tenants
         SET dte_api_key_enc = $1, dte_api_key = NULL, actualizado_en = NOW()
         WHERE id = $2`,
        [cifrado, fila.id]
      );
    }

    logger.info('API Keys DTE cifradas correctamente', { cantidad: rows.length });
  } catch (err) {
    logger.error('Error al cifrar API Keys DTE', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();