// tests/unit/provisioning.test.ts
// Pruebas unitarias de provisión de empresas desde POS (Fase 2).
//
// Criterio de salida Fase 2: una empresa creada desde POS queda visible en
// ambos sistemas con el mismo tenant_id. Se verifica con DTE Service fake:
// flujo completo, idempotencia por operation_id, cifrado de la API Key
// (nunca en claro), confirmación de estado y errores del DTE.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioProvisionPosFactory } from '../../src/features/provisioning/service.js';

const TENANT_NUEVO = 'c0000000-0000-4000-8000-000000000001';
const TENANT_OPERADOR = 'a0000000-0000-4000-8000-000000000001';
const OPERATION = 'd0000000-0000-4000-8000-000000000001';

type Registro = {
  tipo: string;
  url?: string;
  body?: unknown;
};

const crearDbFake = () => {
  const idempotencia = new Map<string, { status: number; body: Record<string, unknown> }>();
  const tenants = new Map<string, Record<string, unknown>>();
  const queries: string[] = [];

  const query = async (text: string, params: unknown[] = []) => {
    queries.push(text.replace(/\s+/g, ' ').trim());

    if (text.includes('FROM idempotency_keys WHERE tenant_id')) {
      const clave = `${params[0]}|${params[1]}`;
      const encontrado = idempotencia.get(clave);
      return { rows: encontrado ? [{ response: encontrado }] : [] };
    }

    if (text.includes('INSERT INTO idempotency_keys')) {
      const clave = `${params[0]}|${params[1]}`;
      idempotencia.set(clave, JSON.parse(params[3] as string));
      return { rows: [] };
    }

    if (text.includes('INSERT INTO tenants')) {
      tenants.set(params[0] as string, {
        id: params[0],
        nombre: params[1],
        nit: params[2],
        fiscal_sync_status: 'pending_fiscal_setup',
      });
      return { rows: [] };
    }

    if (text.includes('UPDATE tenants SET dte_api_key_enc')) {
      const tenant = tenants.get(params[1] as string);
      if (tenant) tenant.dte_api_key_enc = params[0];
      return { rows: [] };
    }

    // Onboarding del tenant nuevo (Fase 7): los sp_* son idempotentes.
    if (text.startsWith('CALL sp_sembrar')) {
      return { rows: [] };
    }

    throw new Error(`Query no contemplada en el fake: ${text}`);
  };

  const obtenerTenant = (id: string) => tenants.get(id);
  const registrosIdempotencia = () => idempotencia.size;

  return { query, obtenerTenant, registrosIdempotencia, queries };
};

const crearClienteFake = (sobre: {
  onPost?: (url: string, body: Record<string, unknown>) => unknown;
  onPatch?: (url: string, body: Record<string, unknown>) => unknown;
}) => {
  const llamadas: Registro[] = [];
  const cliente = {
    post: async (url: string, body: Record<string, unknown>) => {
      llamadas.push({ tipo: 'post', url, body });
      if (sobre.onPost) return sobre.onPost(url, body);
      throw new Error('post no contemplado');
    },
    patch: async (url: string, body: Record<string, unknown>) => {
      llamadas.push({ tipo: 'patch', url, body });
      if (sobre.onPatch) return sobre.onPatch(url, body);
      throw new Error('patch no contemplado');
    },
  };
  return { cliente, llamadas };
};

const datos = {
  tenant_id: TENANT_NUEVO,
  operation_id: OPERATION,
  nombre: 'Empresa Nueva',
  nit: '0614-260967-101-5',
};

test('crearTenantPos: flujo completo — DTE crea, POS cifra clave, confirma estado', async () => {
  const db = crearDbFake();
  const { cliente, llamadas } = crearClienteFake({
    onPost: () => ({
      tenant_id: TENANT_NUEVO,
      nombre: 'Empresa Nueva',
      provisioning_status: 'pending_fiscal_setup',
      api_key: 'clave-tecnica-super-secreta-1234567890',
    }),
    onPatch: () => ({ tenant_id: TENANT_NUEVO, status: 'pending_fiscal_setup' }),
  });

  const servicio = crearServicioProvisionPosFactory({
    db: { query: db.query },
    crearClienteInterno: () => cliente as never,
    cifrar: (texto: string, clave: string) => `enc:v2:cifrado-de:${texto.length}:${clave.length}`,
  });

  const resultado = await servicio.crearTenantPos({
    tenantIdOperador: TENANT_OPERADOR,
    datos,
    operationId: OPERATION,
  });

  assert.equal(resultado.status, 201);
  assert.equal(resultado.body.data.tenant_id, TENANT_NUEVO);
  assert.equal(resultado.body.data.api_key_entregada, true);

  // La API Key nunca se persiste en claro.
  const tenant = db.obtenerTenant(TENANT_NUEVO);
  assert.ok(tenant, 'proyección del tenant creada en POS');
  assert.ok(String(tenant.dte_api_key_enc).startsWith('enc:v2:'), 'clave almacenada cifrada');
  assert.ok(!JSON.stringify(tenant).includes('clave-tecnica-super-secreta'), 'sin clave en claro en BD');

  // Llamadas: POST tenants + PATCH status (confirmación).
  assert.equal(llamadas.length, 2);
  assert.equal(llamadas[0].tipo, 'post');
  assert.equal(llamadas[0].url, '/internal/provisioning/tenants');
  assert.equal((llamadas[0].body as { tenant_id: string }).tenant_id, TENANT_NUEVO);
  assert.equal(llamadas[1].tipo, 'patch');
  assert.equal(llamadas[1].url, `/internal/provisioning/tenants/${TENANT_NUEVO}/status`);

  // Onboarding del tenant nuevo (Fase 7): permisos, catálogos y menús sembrados.
  for (const sp of ['sp_sembrar_permisos_tenant', 'sp_sembrar_catalogos_tenant', 'sp_sembrar_menus_tenant']) {
    assert.ok(db.queries.some((q) => q.includes(sp)), `${sp} debe ejecutarse en el onboarding`);
  }
});

test('crearTenantPos: reintentar el mismo operation_id NO duplica (respuesta cacheada, sin llamada DTE)', async () => {
  const db = crearDbFake();
  const { cliente, llamadas } = crearClienteFake({
    onPost: () => ({
      tenant_id: TENANT_NUEVO,
      nombre: 'Empresa Nueva',
      provisioning_status: 'pending_fiscal_setup',
      api_key: 'clave-tecnica-super-secreta-1234567890',
    }),
    onPatch: () => ({ tenant_id: TENANT_NUEVO, status: 'pending_fiscal_setup' }),
  });

  const servicio = crearServicioProvisionPosFactory({
    db: { query: db.query },
    crearClienteInterno: () => cliente as never,
    cifrar: (texto: string) => `enc:v2:${texto.length}`,
  });

  const primero = await servicio.crearTenantPos({
    tenantIdOperador: TENANT_OPERADOR,
    datos,
    operationId: OPERATION,
  });
  const segundo = await servicio.crearTenantPos({
    tenantIdOperador: TENANT_OPERADOR,
    datos,
    operationId: OPERATION,
  });

  assert.equal(primero.status, 201);
  assert.deepEqual(segundo.body.data, primero.body.data);
  assert.equal(llamadas.filter((l) => l.tipo === 'post').length, 1, 'solo una llamada a DTE');
  assert.equal(db.registrosIdempotencia(), 1);
});

test('crearTenantPos: error del DTE (5xx) se propaga sin crear proyección', async () => {
  const db = crearDbFake();
  const { cliente } = crearClienteFake({
    onPost: () => {
      throw { status: 503, mensaje: 'El servicio de facturación electrónica no está disponible.' };
    },
  });

  const servicio = crearServicioProvisionPosFactory({
    db: { query: db.query },
    crearClienteInterno: () => cliente as never,
    cifrar: (texto: string) => `enc:v2:${texto.length}`,
  });

  await assert.rejects(
    servicio.crearTenantPos({
      tenantIdOperador: TENANT_OPERADOR,
      datos,
      operationId: OPERATION,
    }),
    (err: { status?: number }) => err.status === 503
  );
  assert.equal(db.obtenerTenant(TENANT_NUEVO), undefined, 'sin tenant si el DTE falló');
});

test('crearTenantPos: conflicto del DTE (409, tenant con otro operation_id) se propaga', async () => {
  const db = crearDbFake();
  const { cliente } = crearClienteFake({
    onPost: () => {
      throw { status: 409, mensaje: 'El tenant ya existe y fue creado por otra operación de provisión.' };
    },
  });

  const servicio = crearServicioProvisionPosFactory({
    db: { query: db.query },
    crearClienteInterno: () => cliente as never,
    cifrar: (texto: string) => `enc:v2:${texto.length}`,
  });

  await assert.rejects(
    servicio.crearTenantPos({
      tenantIdOperador: TENANT_OPERADOR,
      datos,
      operationId: OPERATION,
    }),
    (err: { status?: number; mensaje?: string }) =>
      err.status === 409 && String(err.mensaje).includes('otra operación')
  );
});

test('crearTenantPos: DTE devuelve duplicado sin clave (reintento tras confirmación) — no pisa ni reentrega', async () => {
  const db = crearDbFake();
  const { cliente, llamadas } = crearClienteFake({
    onPost: () => ({
      tenant_id: TENANT_NUEVO,
      nombre: 'Empresa Nueva',
      provisioning_status: 'pending_fiscal_setup',
      api_key: null,
    }),
  });

  const servicio = crearServicioProvisionPosFactory({
    db: { query: db.query },
    crearClienteInterno: () => cliente as never,
    cifrar: (texto: string) => `enc:v2:${texto.length}`,
  });

  const resultado = await servicio.crearTenantPos({
    tenantIdOperador: TENANT_OPERADOR,
    datos,
    operationId: OPERATION,
  });

  assert.equal(resultado.status, 201);
  assert.equal(resultado.body.data.api_key_entregada, false);
  assert.equal(llamadas.filter((l) => l.tipo === 'patch').length, 0, 'no reconfirma si no hubo clave');
});