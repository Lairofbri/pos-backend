// scripts/instalar-api-key-tenant.ts
// Instala la API Key de integración POS → DTE de UNA empresa, cifrada con
// AES-256-GCM (`POS_ENCRYPTION_KEY`) en tenants.dte_api_key_enc.
//
// Camino manual (mientras/además de la entrega automática del DTE): el DTE
// frontend muestra la clave UNA sola vez al habilitar el POS.
//
// Uso:
//   $env:DATABASE_URL='postgresql://…'      # BD del POS (o el túnel de Railway)
//   $env:POS_ENCRYPTION_KEY='…'             # la MISMA clave del servicio pos-backend
//   $env:DTE_API_KEY_TENANT='…'             # la clave que mostró el DTE frontend
//   npx tsx scripts/instalar-api-key-tenant.ts <tenantId>
//
// La clave NUNCA se imprime: se cifra, se verifica descifrándola en memoria y
// se guarda; el texto plano en tenants.dte_api_key se limpia.
// Idempotente: volver a ejecutarlo reemplaza la clave del tenant (rotación).

import { pool } from '../src/shared/config/database.js';
import { env } from '../src/shared/config/env.js';
import { encriptarTexto, desencriptarTexto } from '../src/shared/utils/crypto.js';
import { logger } from '../src/shared/utils/logger.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const run = async () => {
  const tenantId = String(process.argv[2] ?? '').trim().toLowerCase();
  const apiKey = process.env.DTE_API_KEY_TENANT;
  const claveMaestra = env.POS_ENCRYPTION_KEY;

  if (!UUID_RE.test(tenantId)) {
    logger.error('Falta el tenant_id o no es un UUID válido', { uso: 'tsx scripts/instalar-api-key-tenant.ts <tenantId>' });
    process.exitCode = 1;
    return;
  }
  if (!apiKey || apiKey.trim().length < 16) {
    logger.error('Falta la clave o es demasiado corta (usar la variable DTE_API_KEY_TENANT)');
    process.exitCode = 1;
    return;
  }
  if (!claveMaestra) {
    logger.error('POS_ENCRYPTION_KEY no está definida (debe ser la misma del servicio pos-backend)');
    process.exitCode = 1;
    return;
  }

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, (dte_api_key_enc IS NOT NULL) AS tenia_clave FROM tenants WHERE id = $1',
      [tenantId]
    );
    if (rows.length === 0) {
      logger.error('Tenant no encontrado en la BD del POS', { tenant_id: tenantId });
      process.exitCode = 1;
      return;
    }

    const cifrado = encriptarTexto(apiKey.trim(), claveMaestra);
    const verificado = cifrado ? desencriptarTexto(cifrado, claveMaestra) === apiKey.trim() : false;
    if (!cifrado || !verificado) {
      logger.error('No se pudo cifrar/verificar la API Key; no se escribió nada', { tenant_id: tenantId });
      process.exitCode = 1;
      return;
    }

    await client.query(
      `UPDATE tenants
          SET dte_api_key_enc = $1, actualizado_en = NOW()
        WHERE id = $2`,
      [cifrado, tenantId]
    );

    const fila = rows[0] as { tenia_clave: boolean };
    logger.info('API Key de integración instalada (cifrada)', {
      tenant_id: tenantId,
      reemplazo: fila.tenia_clave,
    });
  } catch (err) {
    logger.error('Error al instalar la API Key', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

run();
