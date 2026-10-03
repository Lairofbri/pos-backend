import test from 'node:test';
import assert from 'node:assert/strict';
import { encriptarTexto, desencriptarTexto } from '../../src/shared/utils/crypto.ts';

const CLAVE = 'clave-maestra-de-prueba-de-32-caracteres';

test('cifra y descifra correctamente un texto con AES-256-GCM', () => {
  const original = 'empresa-demo-local';
  const cifrado = encriptarTexto(original, CLAVE);
  assert.ok(cifrado);
  assert.ok(cifrado!.startsWith('enc:v2:'));
  assert.notEqual(cifrado, original);
  assert.equal(desencriptarTexto(cifrado, CLAVE), original);
});

test('produce ciphertext distinto en cada operación (salt/IV aleatorio)', () => {
  const a = encriptarTexto('secreto', CLAVE);
  const b = encriptarTexto('secreto', CLAVE);
  assert.notEqual(a, b);
  assert.equal(desencriptarTexto(a, CLAVE), 'secreto');
  assert.equal(desencriptarTexto(b, CLAVE), 'secreto');
});

test('no cifra valores nulos o vacíos', () => {
  assert.equal(encriptarTexto(null, CLAVE), null);
  assert.equal(encriptarTexto('', CLAVE), null);
});

test('rechaza texto cifrado con formato desconocido', () => {
  assert.throws(() => desencriptarTexto('texto-plano', CLAVE), /Formato de cifrado no soportado/);
  assert.throws(() => desencriptarTexto('enc:v2:solo', CLAVE), /Formato de cifrado v2 inválido/);
});

test('detecta manipulación del ciphertext (tag GCM inválido)', () => {
  const cifrado = encriptarTexto('secreto', CLAVE)!;
  const partes = cifrado.split(':');
  partes[partes.length - 1] = Buffer.from('datos-manipulados').toString('base64');
  const manipulado = partes.join(':');
  assert.throws(() => desencriptarTexto(manipulado, CLAVE));
});

test('no descifra con una clave maestra distinta', () => {
  const cifrado = encriptarTexto('secreto', CLAVE);
  assert.throws(() => desencriptarTexto(cifrado, 'otra-clave-maestra-distinta-32'));
});