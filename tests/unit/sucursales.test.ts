// tests/unit/sucursales.test.ts
// Pruebas unitarias de Fase 3 — vínculo de sucursales POS ↔ DTE.
//
// Criterios cubiertos (spec §10 Fase 3, §12 Sucursales/Provisión):
// - Crear sucursal POS genera branch_id y solicita el vínculo al DTE.
// - Fallo del DTE → sucursal queda pending_link + sync_error (retry seguro).
// - Reintentar la misma operación NO duplica sucursales (idempotencia).
// - El evento BRANCH_VINCULADO crea/actualiza la proyección por
//   (tenant_id, branch_id) sin duplicar.
// - BRANCH_VINCULADO sin tenant proyectado → 409 (el outbox reintenta).

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioSucursalesFactory } from '../../src/features/admin/sucursales/crear/service.js';
import { crearServicioVinculoSucursalFactory } from '../../src/features/admin/sucursales/vincular/service.js';
import { crearServicioEventosProvisionFactory } from '../../src/features/internal/provisioning/service.js';
import { recibirEventoSchema } from '../../src/features/internal/provisioning/request.js';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const BRANCH = 'b0000000-0000-4000-8000-000000000005';
const ESTABLECIMIENTO = 'e0000000-0000-4000-8000-000000000001';
const OPERATION = 'c0000000-0000-4000-8000-000000000001';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SucursalRow = {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  dte_establecimiento_id: string | null;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  es_principal: boolean;
  activo: boolean;
  fiscal_status: string;
  sync_error: string | null;
};

const crearDbFake = () => {
  const idempotencia = new Map<string, { status: number; body: Record<string, unknown> }>();
  const sucursales = new Map<string, SucursalRow>();
  const tenants = new Set<string>();

  const query = async (text: string, params: unknown[] = []) => {
    const sql = text.replace(/\s+/g, ' ').trim();

    // Idempotencia
    if (sql.includes('SELECT response FROM idempotency_keys')) {
      const encontrado = idempotencia.get(`${params[0]}|${params[1]}`);
      return { rows: encontrado ? [{ response: encontrado }] : [] };
    }
    if (sql.includes('INSERT INTO idempotency_keys')) {
      idempotencia.set(`${params[0]}|${params[1]}`, JSON.parse(params[3] as string));
      return { rows: [] };
    }

    // Tenant proyectado
    if (sql.includes('SELECT id FROM tenants WHERE id')) {
      return { rows: tenants.has(params[0] as string) ? [{ id: params[0] }] : [] };
    }

    // BRANCH_VINCULADO: upsert por (tenant_id, branch_id) — índice parcial
    if (sql.startsWith('INSERT INTO sucursales') && sql.includes('ON CONFLICT (tenant_id, branch_id) WHERE')) {
      const clave = `${params[0]}|${params[1]}`;
      const existente = sucursales.get(clave);
      if (existente) {
        Object.assign(existente, {
          dte_establecimiento_id: params[2],
          nombre: params[3],
          direccion: (params[4] as string | null) ?? existente.direccion,
          telefono: (params[5] as string | null) ?? existente.telefono,
          fiscal_status: params[6],
          activo: params[7],
          sync_error: null,
        });
      } else {
        sucursales.set(clave, {
          id: `suc-${clave}`,
          tenant_id: params[0] as string,
          branch_id: params[1] as string,
          dte_establecimiento_id: params[2] as string,
          nombre: params[3] as string,
          direccion: (params[4] as string | null) ?? null,
          telefono: (params[5] as string | null) ?? null,
          es_principal: false,
          activo: params[7] as boolean,
          fiscal_status: params[6] as string,
          sync_error: null,
        });
      }
      return { rows: [] };
    }

    // Crear sucursal (flujo crearSucursal) — fiscal_status es literal SQL
    if (sql.startsWith('INSERT INTO sucursales')) {
      const clave = `${params[0]}|${params[1]}`;
      const fila: SucursalRow = {
        id: `suc-${clave}`,
        tenant_id: params[0] as string,
        branch_id: params[1] as string,
        dte_establecimiento_id: null,
        nombre: params[2] as string,
        direccion: (params[3] as string | null) ?? null,
        telefono: (params[4] as string | null) ?? null,
        es_principal: params[5] as boolean,
        activo: true,
        fiscal_status: 'pending_link',
        sync_error: null,
      };
      sucursales.set(clave, fila);
      return { rows: [fila] };
    }

    // Actualizar tras vínculo exitoso (crearSucursal / vincular)
    if (sql.includes('SET dte_establecimiento_id = $1, fiscal_status = $2')
      && sql.includes('sync_error = NULL')) {
      const fila = [...sucursales.values()].find((s) => s.id === params[2]);
      if (fila) {
        fila.dte_establecimiento_id = params[0] as string;
        fila.fiscal_status = params[1] as string;
        fila.sync_error = null;
      }
      return { rows: fila ? [fila] : [] };
    }

    // Actualizar sync_error (fallo del DTE)
    if (sql.includes('SET sync_error = $1')) {
      const fila = [...sucursales.values()].find((s) => s.id === params[1]);
      if (fila) fila.sync_error = params[0] as string;
      return { rows: fila ? [fila] : [] };
    }

    // Vincular: SELECT de la sucursal
    if (sql.includes('FROM sucursales WHERE id = $1 AND tenant_id = $2')) {
      const fila = [...sucursales.values()].find((s) => s.id === params[0] && s.tenant_id === params[1]);
      return { rows: fila ? [fila] : [] };
    }

    throw new Error(`Query no contemplada en el fake: ${sql}`);
  };

  return {
    query,
    sembrarTenant: (id: string) => tenants.add(id),
    sembrarSucursal: (fila: SucursalRow) => sucursales.set(`${fila.tenant_id}|${fila.branch_id}`, fila),
    obtenerSucursal: (clave: string) => sucursales.get(clave),
    conteoSucursales: () => sucursales.size,
    registrosIdempotencia: () => idempotencia.size,
  };
};

const crearClienteFake = (sobre: {
  onPost?: (url: string, body: Record<string, unknown>) => unknown;
  onPostError?: () => unknown;
} = {}) => {
  const llamadas: { url: string; body: Record<string, unknown> }[] = [];
  const cliente = {
    post: async (url: string, body: Record<string, unknown>) => {
      llamadas.push({ url, body });
      if (sobre.onPostError) throw sobre.onPostError();
      return sobre.onPost ? sobre.onPost(url, body) : { ok: true };
    },
  };
  return { cliente, llamadas };
};

// ═════════════════════════════════════════════
// crearSucursal
// ═════════════════════════════════════════════

test('crearSucursal genera branch_id, crea en pending_link y vincula al DTE', async () => {
  const db = crearDbFake();
  const { cliente, llamadas } = crearClienteFake({
    onPost: () => ({ establecimiento_id: ESTABLECIMIENTO, fiscal_status: 'pending_mh_data' }),
  });
  const servicio = crearServicioSucursalesFactory({ db, crearClienteInterno: () => cliente });

  const resultado = await servicio.crearSucursal({
    tenantId: TENANT,
    datos: { nombre: 'Sucursal Norte', direccion: 'Av. Norte 123' },
  });

  assert.equal(resultado.status, 201);
  const sucursal = resultado.body.data.sucursal as SucursalRow;
  assert.match(sucursal.branch_id!, UUID_V4, 'branch_id debe ser UUID v4');
  assert.equal(sucursal.fiscal_status, 'pending_mh_data');
  assert.equal(sucursal.dte_establecimiento_id, ESTABLECIMIENTO);
  assert.equal(sucursal.sync_error, null);

  assert.equal(llamadas.length, 1);
  assert.match(llamadas[0].url, /\/internal\/provisioning\/tenants\/[^/]+\/branches$/);
  assert.equal(llamadas[0].body.branch_id, sucursal.branch_id);
  assert.ok(!JSON.stringify(llamadas[0].body).includes('password'), 'sin credenciales');
});

test('crearSucursal con DTE caído queda pending_link + sync_error sin romper la creación', async () => {
  const db = crearDbFake();
  const { cliente } = crearClienteFake({
    onPostError: () => ({ status: 503, mensaje: 'El servicio de facturación electrónica no está disponible.' }),
  });
  const servicio = crearServicioSucursalesFactory({ db, crearClienteInterno: () => cliente });

  const resultado = await servicio.crearSucursal({
    tenantId: TENANT,
    datos: { nombre: 'Sucursal Centro' },
  });

  assert.equal(resultado.status, 201, 'la creación local no debe fallar');
  const sucursal = resultado.body.data.sucursal as SucursalRow;
  assert.equal(sucursal.fiscal_status, 'pending_link');
  assert.equal(sucursal.dte_establecimiento_id, null);
  assert.ok(sucursal.sync_error, 'debe registrar el error para el retry');
});

test('crearSucursal es idempotente: reintentar con el mismo operation_id NO duplica', async () => {
  const db = crearDbFake();
  const { cliente, llamadas } = crearClienteFake({
    onPost: () => ({ establecimiento_id: ESTABLECIMIENTO, fiscal_status: 'pending_mh_data' }),
  });
  const servicio = crearServicioSucursalesFactory({ db, crearClienteInterno: () => cliente });

  const primero = await servicio.crearSucursal({
    tenantId: TENANT,
    datos: { nombre: 'Sucursal Norte' },
    operationId: OPERATION,
  });

  const segundo = await servicio.crearSucursal({
    tenantId: TENANT,
    datos: { nombre: 'Sucursal Norte' },
    operationId: OPERATION,
  });

  assert.equal(db.conteoSucursales(), 1, 'no debe duplicar la sucursal');
  assert.equal(db.registrosIdempotencia(), 1);
  assert.equal(llamadas.length, 1, 'el DTE solo se llama una vez');
  assert.equal(segundo.status, primero.status);
  assert.deepEqual(segundo.body, primero.body, 'respuesta cacheada idéntica');
});

// ═════════════════════════════════════════════
// vincular (reintento)
// ═════════════════════════════════════════════

test('vincular reintenta y actualiza la sucursal pendiente', async () => {
  const db = crearDbFake();
  db.sembrarSucursal({
    id: 'suc-1', tenant_id: TENANT, branch_id: BRANCH, dte_establecimiento_id: null,
    nombre: 'Sucursal Centro', direccion: null, telefono: null, es_principal: false,
    activo: true, fiscal_status: 'pending_link', sync_error: 'DTE caído',
  });
  const { cliente, llamadas } = crearClienteFake({
    onPost: () => ({ establecimiento_id: ESTABLECIMIENTO, fiscal_status: 'pending_mh_data' }),
  });
  const servicio = crearServicioVinculoSucursalFactory({ db, crearClienteInterno: () => cliente });

  const resultado = await servicio.vincular({ tenantId: TENANT, sucursalId: 'suc-1' });

  assert.equal(resultado.duplicado, false);
  assert.equal(resultado.sucursal.fiscal_status, 'pending_mh_data');
  assert.equal(resultado.sucursal.dte_establecimiento_id, ESTABLECIMIENTO);
  assert.equal(resultado.sucursal.sync_error, null);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].body.branch_id, BRANCH, 'reusa el branch_id ya asignado');
});

test('vincular sobre una sucursal ready es un no-op (no llama al DTE)', async () => {
  const db = crearDbFake();
  db.sembrarSucursal({
    id: 'suc-2', tenant_id: TENANT, branch_id: BRANCH, dte_establecimiento_id: ESTABLECIMIENTO,
    nombre: 'Sucursal Principal', direccion: null, telefono: null, es_principal: true,
    activo: true, fiscal_status: 'ready', sync_error: null,
  });
  const { cliente, llamadas } = crearClienteFake();
  const servicio = crearServicioVinculoSucursalFactory({ db, crearClienteInterno: () => cliente });

  const resultado = await servicio.vincular({ tenantId: TENANT, sucursalId: 'suc-2' });

  assert.equal(resultado.duplicado, true);
  assert.equal(llamadas.length, 0, 'no debe llamar al DTE');
});

test('vincular valida sucursal: inexistente → 404, sin branch_id → 409, inactiva → 409', async () => {
  const db = crearDbFake();
  db.sembrarSucursal({
    id: 'suc-3', tenant_id: TENANT, branch_id: null, dte_establecimiento_id: null,
    nombre: 'Sin vínculo', direccion: null, telefono: null, es_principal: false,
    activo: true, fiscal_status: 'pending_link', sync_error: null,
  });
  const { cliente } = crearClienteFake();
  const servicio = crearServicioVinculoSucursalFactory({ db, crearClienteInterno: () => cliente });

  await assert.rejects(
    servicio.vincular({ tenantId: TENANT, sucursalId: 'no-existe' }),
    (err: { status?: number }) => err.status === 404
  );
  await assert.rejects(
    servicio.vincular({ tenantId: TENANT, sucursalId: 'suc-3' }),
    (err: { status?: number }) => err.status === 409 && String(err.mensaje).includes('branch_id')
  );

  const inactiva: SucursalRow = {
    id: 'suc-4', tenant_id: TENANT, branch_id: BRANCH, dte_establecimiento_id: null,
    nombre: 'Inactiva', direccion: null, telefono: null, es_principal: false,
    activo: false, fiscal_status: 'inactive', sync_error: null,
  };
  db.sembrarSucursal(inactiva);
  await assert.rejects(
    servicio.vincular({ tenantId: TENANT, sucursalId: 'suc-4' }),
    (err: { status?: number }) => err.status === 409 && String(err.mensaje).includes('inactiva')
  );
});

// ═════════════════════════════════════════════
// recibirEvento — BRANCH_VINCULADO (DTE → POS)
// ═════════════════════════════════════════════

const payloadBranch = {
  branch_id: BRANCH,
  establecimiento_id: ESTABLECIMIENTO,
  fiscal_status: 'ready',
  nombre: 'Sucursal Centro',
  direccion: 'Av. Centro 456',
  cod_estable_mh: 'M002',
  cod_punto_venta_mh: 'P001',
  tipo_establecimiento: '02',
};

test('BRANCH_VINCULADO crea la sucursal proyectada cuando el tenant existe', async () => {
  const db = crearDbFake();
  db.sembrarTenant(TENANT);
  const servicio = crearServicioEventosProvisionFactory({ db });

  const resultado = await servicio.recibirEvento({
    operationId: OPERATION,
    tipoEvento: 'BRANCH_VINCULADO',
    tenantId: TENANT,
    payload: payloadBranch,
  });

  assert.equal(resultado.status, 200);
  const sucursal = db.obtenerSucursal(`${TENANT}|${BRANCH}`)!;
  assert.equal(sucursal.dte_establecimiento_id, ESTABLECIMIENTO);
  assert.equal(sucursal.fiscal_status, 'ready');
  assert.equal(sucursal.activo, true);
  assert.equal(sucursal.sync_error, null);
  assert.equal(db.conteoSucursales(), 1);
});

test('BRANCH_VINCULADO actualiza sin duplicar (upsert por tenant+branch)', async () => {
  const db = crearDbFake();
  db.sembrarTenant(TENANT);
  const servicio = crearServicioEventosProvisionFactory({ db });

  await servicio.recibirEvento({
    operationId: OPERATION,
    tipoEvento: 'BRANCH_VINCULADO',
    tenantId: TENANT,
    payload: payloadBranch,
  });

  // Nuevo estado desde DTE (mismo branch) → actualiza la misma fila.
  const resultado = await servicio.recibirEvento({
    operationId: 'c0000000-0000-4000-8000-000000000002',
    tipoEvento: 'BRANCH_VINCULADO',
    tenantId: TENANT,
    payload: { ...payloadBranch, fiscal_status: 'inactive' },
  });

  assert.equal(resultado.status, 200);
  assert.equal(db.conteoSucursales(), 1, 'no debe duplicar');
  const sucursal = db.obtenerSucursal(`${TENANT}|${BRANCH}`)!;
  assert.equal(sucursal.fiscal_status, 'inactive');
  assert.equal(sucursal.activo, false, 'inactive desactiva la sucursal');
});

test('BRANCH_VINCULADO sin tenant proyectado → 409 (el outbox reintenta)', async () => {
  const db = crearDbFake();
  const servicio = crearServicioEventosProvisionFactory({ db });

  await assert.rejects(
    servicio.recibirEvento({
      operationId: OPERATION,
      tipoEvento: 'BRANCH_VINCULADO',
      tenantId: TENANT,
      payload: payloadBranch,
    }),
    (err: { status?: number }) => err.status === 409
  );
  assert.equal(db.conteoSucursales(), 0);
});

test('BRANCH_VINCULADO es idempotente por operation_id', async () => {
  const db = crearDbFake();
  db.sembrarTenant(TENANT);
  const servicio = crearServicioEventosProvisionFactory({ db });

  const primero = await servicio.recibirEvento({
    operationId: OPERATION,
    tipoEvento: 'BRANCH_VINCULADO',
    tenantId: TENANT,
    payload: payloadBranch,
  });

  const repetido = await servicio.recibirEvento({
    operationId: OPERATION,
    tipoEvento: 'BRANCH_VINCULADO',
    tenantId: TENANT,
    payload: payloadBranch,
  });

  assert.equal(db.conteoSucursales(), 1);
  assert.deepEqual(repetido, primero, 'respuesta cacheada');
});

test('recibirEventoSchema valida el payload BRANCH (campos obligatorios)', () => {
  const { error: sinBranch } = recibirEventoSchema.validate({
    operation_id: OPERATION,
    tenant_id: TENANT,
    tipo_evento: 'BRANCH_VINCULADO',
    payload: { establecimiento_id: ESTABLECIMIENTO, fiscal_status: 'ready', nombre: 'X' },
  });
  assert.ok(sinBranch, 'branch_id es obligatorio en el payload');

  const { error: ok } = recibirEventoSchema.validate({
    operation_id: OPERATION,
    tenant_id: TENANT,
    branch_id: BRANCH,
    tipo_evento: 'BRANCH_VINCULADO',
    payload: payloadBranch,
  });
  assert.equal(ok, undefined);

  const { error: estadoInvalido } = recibirEventoSchema.validate({
    operation_id: OPERATION,
    tenant_id: TENANT,
    tipo_evento: 'BRANCH_VINCULADO',
    payload: { ...payloadBranch, fiscal_status: 'emitir' },
  });
  assert.ok(estadoInvalido, 'fiscal_status solo admite estados conocidos');
});