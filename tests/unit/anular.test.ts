// tests/unit/anular.test.ts
// Pruebas de la anulación DTE desde POS (Fase 5 — spec §9 y §10 Fase 5).
//
// La anulación debe conservar el establecimiento original del DTE:
// 1) Se lee de `dtes_orden` (persistido al emitir).
// 2) Filas históricas (pre-Fase 5): se resuelve desde la sucursal de la orden.
// 3) Si no se resuelve, el payload viaja sin establecimiento y el DTE Service
//    lo resuelve desde el propio DTE (codigo_generacion + tenant).
// El payload nunca transporta credenciales del certificado.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioAnularDteFactory } from '../../src/features/dte/anular/service.js';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const CG = '22222222-2222-4222-8222-222222222222';
const ORDEN = '11111111-1111-4111-8111-111111111111';
const EST = 'e0000000-0000-4000-8000-000000000001';

const baseDatos = {
  codigo_generacion: CG,
  tipo_dte: '01',
  motivo_tipo: 1,
  motivo_descripcion: 'Error en datos del documento.',
  nombre_responsable: 'Responsable',
  tipo_doc_responsable: '13',
  num_doc_responsable: '12345678',
};

type Fila = Record<string, unknown>;

const crearDbFake = (dtesOrden: Fila[], ordenesSucursal: Fila[] = []) => {
  const updates: string[] = [];
  const query = async (text: string, params: unknown[] = []) => {
    const sql = text.replace(/\s+/g, ' ').trim();
    if (sql.includes('FROM dtes_orden WHERE codigo_generacion')) {
      const fila = dtesOrden.find((r) => r.codigo_generacion === params[0] && r.tenant_id === params[1]);
      return { rows: fila ? [fila] : [] };
    }
    if (sql.includes('FROM ordenes o')) {
      const fila = ordenesSucursal.find((r) => r.orden_id === params[0] && r.tenant_id === params[1]);
      return { rows: fila ? [fila] : [] };
    }
    if (sql.includes("SET estado = 'anulado'")) {
      updates.push(sql);
      return { rows: [] };
    }
    return { rows: [] };
  };
  return { query, updates };
};

const crearClienteFake = () => {
  const llamadas: Array<{ url: string; body: Record<string, unknown> }> = [];
  const obtenerCliente = async () => ({
    post: async (url: string, body: Record<string, unknown>) => {
      llamadas.push({ url, body });
      return {};
    },
  });
  return { llamadas, obtenerCliente };
};

test('anula usando el establecimiento persistido en dtes_orden', async () => {
  const db = crearDbFake([{ codigo_generacion: CG, tenant_id: TENANT, orden_id: ORDEN, dte_establecimiento_id: EST }]);
  const cliente = crearClienteFake();
  const { anular } = crearServicioAnularDteFactory({ db, obtenerCliente: cliente.obtenerCliente });

  const resultado = await anular({ tenantId: TENANT, usuarioId: 'u1', datos: baseDatos });

  assert.equal(resultado.estado, 'anulado');
  assert.equal(cliente.llamadas.length, 1);
  assert.equal(cliente.llamadas[0].url, '/api/dte/anular');
  assert.equal(cliente.llamadas[0].body.establecimiento_id, EST);
  assert.equal(cliente.llamadas[0].body.codigo_generacion, CG);
  assert.ok(db.updates.length === 1);
});

test('DTE histórico sin establecimiento: lo resuelve desde la sucursal de la orden', async () => {
  const db = crearDbFake(
    [{ codigo_generacion: CG, tenant_id: TENANT, orden_id: ORDEN, dte_establecimiento_id: null }],
    [{ orden_id: ORDEN, tenant_id: TENANT, dte_establecimiento_id: EST }]
  );
  const cliente = crearClienteFake();
  const { anular } = crearServicioAnularDteFactory({ db, obtenerCliente: cliente.obtenerCliente });

  await anular({ tenantId: TENANT, usuarioId: 'u1', datos: baseDatos });

  assert.equal(cliente.llamadas[0].body.establecimiento_id, EST);
});

test('sin establecimiento resoluble: payload sin establecimiento_id (DTE lo resuelve)', async () => {
  const db = crearDbFake([{ codigo_generacion: CG, tenant_id: TENANT, orden_id: ORDEN, dte_establecimiento_id: null }]);
  const cliente = crearClienteFake();
  const { anular } = crearServicioAnularDteFactory({ db, obtenerCliente: cliente.obtenerCliente });

  await anular({ tenantId: TENANT, usuarioId: 'u1', datos: baseDatos });

  assert.equal('establecimiento_id' in cliente.llamadas[0].body, false);
});

test('el payload nunca transporta credenciales del certificado', async () => {
  const db = crearDbFake([{ codigo_generacion: CG, tenant_id: TENANT, orden_id: ORDEN, dte_establecimiento_id: EST }]);
  const cliente = crearClienteFake();
  const { anular } = crearServicioAnularDteFactory({ db, obtenerCliente: cliente.obtenerCliente });

  await anular({ tenantId: TENANT, usuarioId: 'u1', datos: baseDatos });

  const body = cliente.llamadas[0].body;
  for (const secreto of ['password_pri', 'passwordPri', 'password', 'token']) {
    assert.ok(!(secreto in body), `no debe incluir ${secreto}`);
  }
});