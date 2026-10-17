// tests/unit/api-key-dte.test.ts
// Entrega automática de la API Key de integración POS → DTE (2026-10-17).
//
// Criterios:
// - Se guarda CIFRADA (AES-256-GCM) — única forma de persistencia (F5 retiró
//   la columna en claro `dte_api_key`).
// - La clave no se pierde: descifra exactamente lo recibido.
// - Tenant no proyectado → 409 (el DTE puede reintentar tras TENANT_CREADO).
// - Clave inválida (corta) → 400.
// - Rotación: una clave nueva sobrescribe la anterior.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioEventosProvisionFactory } from '../../src/features/internal/provisioning/service.js';
import { guardarApiKeyDteSchema } from '../../src/features/internal/provisioning/request.js';
import { desencriptarTexto } from '../../src/shared/utils/crypto.js';
import { env } from '../../src/shared/config/env.js';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const CLAVE = 'pos_dte_ABC123xyz7890';
const CLAVE_ROTADA = 'pos_dte_ROTADA9876543210';

const crearDbFake = () => {
  const tenants = new Set<string>();
  let enc: string | null = null;

  const query = async (text: string, params: unknown[] = []) => {
    const sql = text.replace(/\s+/g, ' ').trim();

    if (sql.includes('SELECT id FROM tenants WHERE id')) {
      return { rows: tenants.has(params[0] as string) ? [{ id: params[0] }] : [] };
    }
    if (sql.startsWith('UPDATE tenants') && sql.includes('dte_api_key_enc')) {
      if (!tenants.has(params[1] as string)) throw new Error('violates foreign key constraint');
      enc = params[0] as string;
      return { rows: [] };
    }
    throw new Error(`Query no contemplada en el fake: ${sql}`);
  };

  return {
    query,
    proyectarTenant: (tenantId: string) => tenants.add(tenantId),
    obtenerEnc: () => enc,
  };
};

test('guarda la API Key cifrada (única persistencia; sin columna en claro desde F5)', async () => {
  const db = crearDbFake();
  db.proyectarTenant(TENANT);
  const servicio = crearServicioEventosProvisionFactory({ db });

  const resultado = await servicio.guardarApiKeyDte({ tenantId: TENANT, apiKey: CLAVE });

  assert.deepEqual(resultado, { tenant_id: TENANT, configurada: true });
  const enc = db.obtenerEnc();
  assert.ok(enc, 'se persistió el valor cifrado');
  assert.ok(enc!.startsWith('enc:v2:'), 'formato versionado de cifrado');
  assert.equal(desencriptarTexto(enc, env.POS_ENCRYPTION_KEY), CLAVE, 'descifra exactamente la clave recibida');
});

test('rotación: una clave nueva sobrescribe la anterior', async () => {
  const db = crearDbFake();
  db.proyectarTenant(TENANT);
  const servicio = crearServicioEventosProvisionFactory({ db });

  await servicio.guardarApiKeyDte({ tenantId: TENANT, apiKey: CLAVE });
  await servicio.guardarApiKeyDte({ tenantId: TENANT, apiKey: CLAVE_ROTADA });

  assert.equal(desencriptarTexto(db.obtenerEnc(), env.POS_ENCRYPTION_KEY), CLAVE_ROTADA);
});

test('rechaza con 409 si el tenant no está proyectado (el DTE reintenta luego)', async () => {
  const db = crearDbFake();
  const servicio = crearServicioEventosProvisionFactory({ db });

  await assert.rejects(
    servicio.guardarApiKeyDte({ tenantId: TENANT, apiKey: CLAVE }),
    (err: unknown) =>
      (err as { status?: number }).status === 409 && /proyectado/.test((err as { mensaje?: string }).mensaje ?? '')
  );
  assert.equal(db.obtenerEnc(), null);
});

test('schema: exige api_key de longitud razonable', () => {
  assert.ok(guardarApiKeyDteSchema.validate({ api_key: CLAVE }).error === undefined);
  assert.ok(guardarApiKeyDteSchema.validate({ api_key: 'corta' }).error);
  assert.ok(guardarApiKeyDteSchema.validate({}).error);
});
