// tests/unit/emitir-contexto-fiscal.test.ts
// F5 — resolución del contexto fiscal de la emisión
// (spec «DTE única fuente de verdad de empresa y sucursal» §4 F5).
//
// Criterio: una orden SIN sucursal (o con un id local ya retirado) igual emite:
// el cobro ya está hecho y el POS resuelve el establecimiento PREDETERMINADO
// del tenant contra el DTE. Era la causa del 409 «La orden no tiene una
// sucursal operativa» en empresas creadas desde el DTE (el administrador del
// onboarding nace con `sucursal_id = NULL`).

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearResolverContextoFiscal } from '../../src/features/dte/emitir/service.js';
import type { ContextoFiscalEstablecimiento } from '../../src/shared/dte-empresa.js';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const EST_PRINCIPAL = 'e0000000-0000-4000-8000-00000000000a';
const BRANCH_PRINCIPAL = 'b0000000-0000-4000-8000-00000000000a';

const principal: ContextoFiscalEstablecimiento = {
  id: EST_PRINCIPAL,
  branch_id: BRANCH_PRINCIPAL,
  dte_establecimiento_id: EST_PRINCIPAL,
  fiscal_status: 'ready',
  activo: true,
  nombre: 'Sucursal Principal',
};

test('la orden con sucursal resoluble no consulta el predeterminado', async () => {
  let consultasPredeterminado = 0;
  const resolver = crearResolverContextoFiscal({
    resolverEstablecimiento: async () => principal,
    resolverPredeterminado: async () => {
      consultasPredeterminado += 1;
      return principal;
    },
  });

  const contexto = await resolver(TENANT, { sucursal_id: EST_PRINCIPAL });

  assert.equal(contexto.dte_establecimiento_id, EST_PRINCIPAL);
  assert.equal(contexto.branch_id, BRANCH_PRINCIPAL);
  assert.equal(consultasPredeterminado, 0);
});

test('la orden sin sucursal emite con el establecimiento predeterminado (fin del 409)', async () => {
  const resolver = crearResolverContextoFiscal({
    resolverEstablecimiento: async () => null,
    resolverPredeterminado: async () => principal,
  });

  const contexto = await resolver(TENANT, { sucursal_id: null });

  assert.equal(contexto.id, EST_PRINCIPAL);
  assert.equal(contexto.branch_id, BRANCH_PRINCIPAL);
  assert.equal(contexto.fiscal_status, 'ready');
});

test('la orden con un id local retirado emite con el establecimiento predeterminado', async () => {
  const resolver = crearResolverContextoFiscal({
    resolverEstablecimiento: async () => null,
    resolverPredeterminado: async () => principal,
  });

  const contexto = await resolver(TENANT, { sucursal_id: 'b0000000-0000-4000-8000-000000000001' });

  assert.equal(contexto.dte_establecimiento_id, EST_PRINCIPAL);
});

test('sin establecimientos en el DTE la emisión sigue bloqueada con 409 explícito', async () => {
  const resolver = crearResolverContextoFiscal({
    resolverEstablecimiento: async () => null,
    resolverPredeterminado: async () => null,
  });

  await assert.rejects(
    resolver(TENANT, { sucursal_id: null }),
    (err: { status?: number; mensaje?: string }) =>
      err.status === 409 && !!err.mensaje?.includes('no tiene una sucursal operativa')
  );
});

test('un establecimiento predeterminado sin vínculo fiscal listo no emite', async () => {
  const resolver = crearResolverContextoFiscal({
    resolverEstablecimiento: async () => null,
    resolverPredeterminado: async () => ({ ...principal, fiscal_status: 'pending_mh_data' }),
  });

  await assert.rejects(
    resolver(TENANT, { sucursal_id: null }),
    (err: { status?: number }) => err.status === 409
  );
});

// ─────────────────────────────────────────────────────────────
// Regresión 2026-10-17 — «La sucursal no tiene un vínculo fiscal DTE
// confirmado y listo para emitir».
//
// Las sucursales creadas DIRECTAMENTE en el DTE Service (Frontend DTE) nacen
// sin `branch_id`: ese id es solo el vínculo operativo histórico con el POS.
// El DTE sí las considera emitibles (`fiscal_status = ready` + `activo`), así
// que el POS no debe bloquearlas.
// ─────────────────────────────────────────────────────────────
test('un establecimiento ready SIN branch_id (creado en el DTE) emite igual', async () => {
  const sinBranch: ContextoFiscalEstablecimiento = {
    ...principal,
    branch_id: null,
    nombre: 'CASA MATRIZ',
  };
  const resolver = crearResolverContextoFiscal({
    resolverEstablecimiento: async () => sinBranch,
    resolverPredeterminado: async () => sinBranch,
  });

  const contexto = await resolver(TENANT, { sucursal_id: EST_PRINCIPAL });

  assert.equal(contexto.dte_establecimiento_id, EST_PRINCIPAL);
  assert.equal(contexto.branch_id, null);
  assert.equal(contexto.fiscal_status, 'ready');
});

test('un establecimiento inactivo no emite y el mensaje indica el motivo', async () => {
  const resolver = crearResolverContextoFiscal({
    resolverEstablecimiento: async () => ({ ...principal, activo: false, nombre: 'Sucursal Norte' }),
    resolverPredeterminado: async () => null,
  });

  await assert.rejects(
    resolver(TENANT, { sucursal_id: EST_PRINCIPAL }),
    (err: { status?: number; mensaje?: string }) =>
      err.status === 409
      && !!err.mensaje?.includes('Sucursal Norte')
      && !!err.mensaje?.includes('inactiva')
  );
});

test('un establecimiento no ready no emite y el mensaje incluye el estado fiscal real', async () => {
  const resolver = crearResolverContextoFiscal({
    resolverEstablecimiento: async () => ({ ...principal, fiscal_status: 'pending_mh_data' }),
    resolverPredeterminado: async () => null,
  });

  await assert.rejects(
    resolver(TENANT, { sucursal_id: EST_PRINCIPAL }),
    (err: { status?: number; mensaje?: string }) =>
      err.status === 409 && !!err.mensaje?.includes('pending_mh_data')
  );
});
