import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapearEstadoFiscal, extraerResultado, ESTADOS_FISCALES } from '../../src/features/dte/estados.ts';

test('mapearEstadoFiscal: normaliza estados del dte-service al vocabulario del POS', () => {
  assert.equal(mapearEstadoFiscal('aceptado'), 'aceptado');
  assert.equal(mapearEstadoFiscal('rechazado'), 'rechazado');
  assert.equal(mapearEstadoFiscal('contingencia'), 'contingencia');
  assert.equal(mapearEstadoFiscal('anulado'), 'anulado');
  // En tránsito → enviado
  assert.equal(mapearEstadoFiscal('generado'), 'enviado');
  assert.equal(mapearEstadoFiscal('firmado'), 'enviado');
  assert.equal(mapearEstadoFiscal('transmitido'), 'enviado');
  // Desconocido / ausente → pendiente
  assert.equal(mapearEstadoFiscal(undefined), 'pendiente');
  assert.equal(mapearEstadoFiscal('estado-inesperado'), 'pendiente');
});

test('mapearEstadoFiscal: todos los estados definidos están en el vocabulario explícito', () => {
  const vocabulario = new Set([
    'pendiente', 'generando', 'firmado', 'enviado',
    'aceptado', 'rechazado', 'contingencia', 'anulado',
  ]);
  for (const v of Object.values(ESTADOS_FISCALES)) {
    assert.ok(vocabulario.has(v), `estado ${v} debe pertenecer al vocabulario explícito`);
  }
});

test('extraerResultado: desenvuelve la respuesta { ok, data } del dte-service', () => {
  const resultado = extraerResultado({
    ok: true,
    data: { estado: 'aceptado', codigo_generacion: 'ABC', numero_control: 'DTE-01-...' },
  });
  assert.equal(resultado.estado, 'aceptado');
  assert.equal(resultado.codigo_generacion, 'ABC');
});

test('extraerResultado: usa la respuesta directa si no está envuelta en data', () => {
  const resultado = extraerResultado({ estado: 'rechazado' });
  assert.equal(resultado.estado, 'rechazado');
});

test('extraerResultado: devuelve la respuesta tal cual si no tiene forma de DTE', () => {
  const resp = { status: 503, mensaje: 'Servicio no disponible' };
  assert.deepEqual(extraerResultado(resp), resp);
});