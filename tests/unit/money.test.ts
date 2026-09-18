import test from 'node:test';
import assert from 'node:assert/strict';
import { fromCents, percentageCents, sumCents, toCents } from '../../src/shared/utils/money.ts';

test('opera montos monetarios en centavos sin errores de punto flotante', () => {
  assert.equal(sumCents(['10.10', '0.20']), 1030);
  assert.equal(fromCents(sumCents(['10.10', '0.20'])), 10.3);
  assert.equal(toCents('4.50'), 450);
});

test('calcula la propina porcentual sobre el total fiscal', () => {
  assert.equal(percentageCents(4550, 10, 'propina'), 455);
});

test('rechaza montos con más de dos decimales', () => {
  assert.throws(() => toCents('10.001'));
});
