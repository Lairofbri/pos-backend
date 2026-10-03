// tests/unit/emitir-payload.test.ts
// Pruebas del payload de emisión POS → DTE (Fase 5 — spec §9 y §10 Fase 5).
//
// Criterio: el POS resuelve la sucursal activa al establecimiento DTE y lo
// transporta (establecimiento_id + branch_id). Los códigos MH del tenant
// (cod_estable_mh/cod_punto_venta_mh) ya NO son la fuente de selección y
// NO se envían.

import test from 'node:test';
import assert from 'node:assert/strict';
import { construirPayloadEmitir } from '../../src/features/dte/emitir/service.js';

const BRANCH_A = 'b0000000-0000-4000-8000-000000000001';
const BRANCH_B = 'b0000000-0000-4000-8000-000000000002';
const EST_A = 'e0000000-0000-4000-8000-000000000001';
const EST_B = 'e0000000-0000-4000-8000-000000000002';

const sucursal = (branchId: string, estId: string) => ({
  id: `s-${branchId}`,
  branch_id: branchId,
  dte_establecimiento_id: estId,
  fiscal_status: 'ready',
  activo: true,
});

const orden = {
  total: 10,
  numero_orden: '10025',
  sucursal_id: 's-b0000000-0000-4000-8000-000000000001',
};

const items = [
  {
    producto_id: 'p1',
    producto_nombre: 'Café',
    producto_codigo: 'CAF',
    precio_unitario: 10,
    cantidad: 1,
    subtotal: 10,
    descuento_promo: 0,
    descuento_porcentaje: 0,
  },
];

const pagos = [{ metodo: 'efectivo', total_pagado: 10, vuelto: 0 }];

test('payload incluye establecimiento_id y branch_id de la sucursal fiscal', () => {
  const { payloadBase } = construirPayloadEmitir({
    ordenId: 'o1',
    orden,
    items,
    pagos,
    sucursalFiscal: sucursal(BRANCH_A, EST_A),
    tipoDte: '01',
  });

  assert.equal(payloadBase.establecimiento_id, EST_A);
  assert.equal(payloadBase.branch_id, BRANCH_A);
});

test('payload NO incluye códigos MH del tenant (autoridad = establecimiento)', () => {
  const { payloadBase } = construirPayloadEmitir({
    ordenId: 'o1',
    orden,
    items,
    pagos,
    sucursalFiscal: sucursal(BRANCH_A, EST_A),
    tipoDte: '01',
  });

  assert.ok(!('cod_estable_mh' in payloadBase));
  assert.ok(!('cod_punto_venta_mh' in payloadBase));
});

test('dos sucursales del mismo tenant transportan establecimientos distintos', () => {
  const a = construirPayloadEmitir({
    ordenId: 'o1',
    orden,
    items,
    pagos,
    sucursalFiscal: sucursal(BRANCH_A, EST_A),
    tipoDte: '01',
  }).payloadBase;
  const b = construirPayloadEmitir({
    ordenId: 'o2',
    orden,
    items,
    pagos,
    sucursalFiscal: sucursal(BRANCH_B, EST_B),
    tipoDte: '01',
  }).payloadBase;

  assert.notEqual(a.establecimiento_id, b.establecimiento_id);
  assert.notEqual(a.branch_id, b.branch_id);
});

test('payload conserva clave idempotente tenant+orden+tipo', () => {
  const { payloadBase } = construirPayloadEmitir({
    ordenId: 'o1',
    orden,
    items,
    pagos,
    sucursalFiscal: sucursal(BRANCH_A, EST_A),
    tipoDte: '01',
  });

  assert.equal(payloadBase.idempotency_key, 'o1:01');
});

test('payload mapea items y pagos fiscales correctamente', () => {
  const { payloadBase } = construirPayloadEmitir({
    ordenId: 'o1',
    orden,
    items,
    pagos,
    sucursalFiscal: sucursal(BRANCH_A, EST_A),
    tipoDte: '01',
  });

  const cuerpoItems = payloadBase.items as Array<Record<string, unknown>>;
  assert.equal(cuerpoItems.length, 1);
  assert.equal(cuerpoItems[0].descripcion, 'Café');

  const pagosMH = payloadBase.pagos as Array<Record<string, unknown>>;
  assert.equal(pagosMH.length, 1);
  assert.equal(pagosMH[0].codigo, '01');
  assert.equal(pagosMH[0].montoPago, 10);
});