// tests/unit/sucursales.test.ts
// Pruebas unitarias de F5 — el POS deja de proyectar empresa/sucursal
// (spec «DTE única fuente de verdad de empresa y sucursal», 2026-10-16).
//
// Criterio de salida de F5: la base del POS no tiene datos de empresa ni tabla
// `sucursales`; el sistema opera con el DTE como fuente.
//
// Se cubre:
// - `TENANT_CREADO` proyecta SOLO identidad técnica del tenant (id/activo) y
//   siembra el onboarding operativo (permisos + catálogos).
// - `BRANCH_VINCULADO` se acepta (ack idempotente para el outbox del DTE) pero
//   NO escribe nada: no existe proyección local de sucursales.
// - El resolver de sucursal valida `X-Sucursal-Id` contra los establecimientos
//   del DTE (establecimiento_id canónico), degrada si el DTE no responde, cae
//   al `sucursal_id` del JWT y, si no hay ninguno, usa el establecimiento
//   PREDETERMINADO del DTE (matriz) para que las órdenes nunca nazcan sin
//   sucursal (era la causa del 409 al emitir el DTE).

import test from 'node:test';
import assert from 'node:assert/strict';
import type { NextFunction, Request, Response } from 'express';
import { crearServicioEventosProvisionFactory } from '../../src/features/internal/provisioning/service.js';
import { crearResolverSucursal } from '../../src/shared/middlewares/sucursal.middleware.js';
import { recibirEventoSchema } from '../../src/features/internal/provisioning/request.js';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const OTRO_TENANT = 'a0000000-0000-4000-8000-000000000002';
const BRANCH = 'b0000000-0000-4000-8000-000000000005';
const ESTABLECIMIENTO = 'e0000000-0000-4000-8000-000000000001';
const OPERATION = 'c0000000-0000-4000-8000-000000000001';

const crearDbFake = () => {
  const idempotencia = new Map<string, { status: number; body: Record<string, unknown> }>();
  const tenants = new Map<string, { id: string; activo: boolean }>();
  const siembras: string[] = [];
  const escriturasProhibidas: string[] = [];

  const query = async (text: string, params: unknown[] = []) => {
    const sql = text.replace(/\s+/g, ' ').trim();

    if (sql.startsWith('SELECT response FROM idempotency_keys')) {
      const encontrado = idempotencia.get(`${params[0]}|${params[1]}`);
      return { rows: encontrado ? [{ response: encontrado }] : [] };
    }
    if (sql.startsWith('INSERT INTO idempotency_keys')) {
      idempotencia.set(`${params[0]}|${params[1]}`, JSON.parse(params[3] as string));
      return { rows: [] };
    }
    if (sql.startsWith('INSERT INTO tenants')) {
      tenants.set(params[0] as string, { id: params[0] as string, activo: true });
      return { rows: [] };
    }
    if (sql.startsWith('SELECT id FROM tenants WHERE id')) {
      return { rows: tenants.has(params[0] as string) ? [{ id: params[0] }] : [] };
    }
    if (sql.startsWith('CALL sp_sembrar_')) {
      siembras.push(sql.slice('CALL '.length).replace('($1)', ''));
      return { rows: [] };
    }

    // F5: cualquier escritura a `sucursales` es un fallo del contrato.
    if (/^(INSERT INTO|UPDATE|DELETE FROM) sucursales/i.test(sql)) {
      escriturasProhibidas.push(sql);
      throw new Error(`F5: el POS no debe escribir en \`sucursales\`: ${sql}`);
    }

    throw new Error(`Query no contemplada en el fake: ${sql}`);
  };

  return {
    query,
    proyectarTenant: (tenantId: string) =>
      tenants.set(tenantId, { id: tenantId, activo: true }),
    obtenerTenant: (tenantId: string) => tenants.get(tenantId),
    contarTenants: () => tenants.size,
    siembras: () => [...siembras],
    escriturasProhibidas: () => [...escriturasProhibidas],
  };
};

// ═════════════════════════════════════════════
// Recepción de eventos de provisión
// ═════════════════════════════════════════════

test('TENANT_CREADO proyecta solo identidad técnica (id/activo) y siembra el onboarding', async () => {
  const db = crearDbFake();
  const servicio = crearServicioEventosProvisionFactory({ db });

  const resultado = await servicio.recibirEvento({
    operationId: OPERATION,
    tipoEvento: 'TENANT_CREADO',
    tenantId: TENANT,
    payload: {
      nombre: 'COPY SERVITEC SOCIEDAD ANONIMA DE CAPITAL VARIABLE',
      nombre_comercial: 'COPY SERVITEC',
      nit: '0623-271125-102-2',
      nrc: '3765751',
    },
  });

  assert.equal(resultado.status, 200);
  assert.deepEqual(db.obtenerTenant(TENANT), { id: TENANT, activo: true }, 'sin datos de empresa: la fila es solo id/activo');
  assert.deepEqual(
    db.siembras(),
    ['sp_sembrar_permisos_tenant', 'sp_sembrar_catalogos_tenant'],
    'sin la siembra la empresa nueva queda sin permisos ni catálogos'
  );
});

test('TENANT_CREADO es idempotente (no duplica el tenant proyectado)', async () => {
  const db = crearDbFake();
  const servicio = crearServicioEventosProvisionFactory({ db });

  await servicio.recibirEvento({
    operationId: OPERATION,
    tipoEvento: 'TENANT_CREADO',
    tenantId: TENANT,
    payload: { nombre: 'Empresa Uno', nit: '0000-000000-000-0' },
  });
  await servicio.recibirEvento({
    operationId: 'c0000000-0000-4000-8000-000000000002',
    tipoEvento: 'TENANT_CREADO',
    tenantId: TENANT,
    payload: { nombre: 'Empresa Uno renombrada', nit: '0000-000000-000-0' },
  });

  assert.equal(db.contarTenants(), 1);
});

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

test('BRANCH_VINCULADO se acepta pero NO proyecta sucursales (F5)', async () => {
  const db = crearDbFake();
  const servicio = crearServicioEventosProvisionFactory({ db });

  const resultado = await servicio.recibirEvento({
    operationId: OPERATION,
    tipoEvento: 'BRANCH_VINCULADO',
    tenantId: TENANT,
    payload: payloadBranch,
  });

  assert.equal(resultado.status, 200, 'ack idempotente para el outbox del DTE');
  assert.deepEqual(db.escriturasProhibidas(), [], 'no escribe en `sucursales`');
});

test('BRANCH_VINCULADO es idempotente por operation_id', async () => {
  const db = crearDbFake();
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

  assert.deepEqual(repetido, primero, 'respuesta cacheada');
  assert.deepEqual(db.escriturasProhibidas(), []);
});

test('BRANCH_VINCULADO no exige un tenant proyectado (el POS ya no guarda sucursales)', async () => {
  const db = crearDbFake();
  const servicio = crearServicioEventosProvisionFactory({ db });

  const resultado = await servicio.recibirEvento({
    operationId: OPERATION,
    tipoEvento: 'BRANCH_VINCULADO',
    tenantId: OTRO_TENANT,
    payload: payloadBranch,
  });

  assert.equal(resultado.status, 200);
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

// ═════════════════════════════════════════════
// Resolver de sucursal (X-Sucursal-Id canónico del DTE)
// ═════════════════════════════════════════════

const crearReqFake = (headers: Record<string, string>, usuario: Record<string, unknown> = {}): Request =>
  ({
    headers,
    ip: '127.0.0.1',
    usuario: { id: 'u-1', tenant_id: TENANT, sucursal_id: null, ...usuario },
  }) as unknown as Request;

const ejecutarResolver = async (
  resolver: ReturnType<typeof crearResolverSucursal>,
  req: Request
): Promise<string | undefined> => {
  let llamoNext = false;
  await resolver(req, {} as Response, (() => { llamoNext = true; }) as NextFunction);
  assert.ok(llamoNext, 'siempre llama a next()');
  return req.sucursalId;
};

test('acepta X-Sucursal-Id cuando es un establecimiento del tenant', async () => {
  const resolver = crearResolverSucursal({
    listarEstablecimientos: async () => [{ id: ESTABLECIMIENTO }],
  });

  const sucursalId = await ejecutarResolver(
    resolver,
    crearReqFake({ 'x-sucursal-id': ESTABLECIMIENTO })
  );

  assert.equal(sucursalId, ESTABLECIMIENTO);
});

test('ignora X-Sucursal-Id que no pertenece al tenant y cae al JWT', async () => {
  const resolver = crearResolverSucursal({
    listarEstablecimientos: async () => [{ id: ESTABLECIMIENTO }],
  });

  const sucursalId = await ejecutarResolver(
    resolver,
    crearReqFake({ 'x-sucursal-id': 'e0000000-0000-4000-8000-0000000000ff' }, { sucursal_id: ESTABLECIMIENTO })
  );

  assert.equal(sucursalId, ESTABLECIMIENTO, 'cae al sucursal_id del JWT');
});

test('con el DTE caído acepta el X-Sucursal-Id canónico (no hay tabla local que validar)', async () => {
  const resolver = crearResolverSucursal({
    listarEstablecimientos: async () => {
      throw new Error('DTE no disponible');
    },
  });

  const sucursalId = await ejecutarResolver(
    resolver,
    crearReqFake({ 'x-sucursal-id': ESTABLECIMIENTO })
  );

  assert.equal(sucursalId, ESTABLECIMIENTO);
});

test('sin header usa el sucursal_id del JWT', async () => {
  const resolver = crearResolverSucursal({
    listarEstablecimientos: async () => [{ id: ESTABLECIMIENTO }],
  });

  const sucursalId = await ejecutarResolver(resolver, crearReqFake({}, { sucursal_id: ESTABLECIMIENTO }));
  assert.equal(sucursalId, ESTABLECIMIENTO);
});

// ═════════════════════════════════════════════
// F5 — establecimiento PREDETERMINADO (cierra el 409 de emisión)
// ═════════════════════════════════════════════

const PRINCIPAL = 'e0000000-0000-4000-8000-0000000000aa';
const SECUNDARIA = 'e0000000-0000-4000-8000-0000000000bb';

test('sin header ni sucursal en el JWT usa el establecimiento predeterminado (matriz)', async () => {
  const resolver = crearResolverSucursal({
    listarEstablecimientos: async () => [
      { id: PRINCIPAL, es_principal: true, activo: true, fiscal_status: 'ready' },
      { id: SECUNDARIA, es_principal: false, activo: true, fiscal_status: 'ready' },
    ],
  });

  const sucursalId = await ejecutarResolver(resolver, crearReqFake({}));

  assert.equal(sucursalId, PRINCIPAL, 'una empresa recién creada no queda sin contexto de sucursal');
});

test('una sucursal del JWT que no es del DTE no bloquea: se usa la predeterminada', async () => {
  const resolver = crearResolverSucursal({
    listarEstablecimientos: async () => [{ id: PRINCIPAL, es_principal: true, activo: true, fiscal_status: 'ready' }],
  });

  const sucursalId = await ejecutarResolver(
    resolver,
    crearReqFake({}, { sucursal_id: 'b0000000-0000-4000-8000-000000000001' })
  );

  assert.equal(sucursalId, PRINCIPAL, 'jamás se propaga un id local retirado: se emite con la canónica');
});

test('sin establecimientos no inventa sucursal', async () => {
  const resolver = crearResolverSucursal({ listarEstablecimientos: async () => [] });

  assert.equal(await ejecutarResolver(resolver, crearReqFake({})), undefined);
});
