// tests/unit/usuario-inicial.test.ts
// Usuario administrador inicial del tenant (evento USUARIO_INICIAL, 2026-10-07).
//
// Criterios cubiertos (decisión propietario + spec §3.3/§11):
// - El POS recibe SOLO hashes bcrypt: password/pin en claro NUNCA llegan.
// - Crea el usuario con rol administrador (matriz completa de permisos).
// - Idempotente: reenvío del mismo evento NO duplica el usuario.
// - Aislamiento: tenant no proyectado → 409 (outbox reintenta).
// - Aislamiento: email ya usado por OTRA empresa → 409 (no inserta).
// - Schema: rechaza textos planos y claves no bcrypt.

import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioEventosProvisionFactory } from '../../src/features/internal/provisioning/service.js';
import { recibirEventoSchema } from '../../src/features/internal/provisioning/request.js';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const OTRO_TENANT = 'a0000000-0000-4000-8000-000000000002';
const OPERATION = 'c0000000-0000-4000-8000-000000000001';
const EMAIL = 'admin@demo.sv';
const HASH_BCRYPT = '$2b$12$abcdefghijABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEFGHIJABCDEF12';

type UsuarioRow = {
  id: string;
  tenant_id: string;
  sucursal_id: string | null;
  nombre: string;
  apellido: string | null;
  email: string;
  password_hash: string;
  pin_hash: string;
  rol: string;
};

const crearDbFake = () => {
  const idempotencia = new Map<string, { status: number; body: Record<string, unknown> }>();
  const tenants = new Set<string>();
  const usuarios = new Map<string, UsuarioRow>();
  let siguiente = 1;

  const query = async (text: string, params: unknown[] = []) => {
    const sql = text.replace(/\s+/g, ' ').trim();

    if (sql.includes('SELECT response FROM idempotency_keys')) {
      const encontrado = idempotencia.get(`${params[0]}|${params[1]}`);
      return { rows: encontrado ? [{ response: encontrado }] : [] };
    }
    if (sql.includes('INSERT INTO idempotency_keys')) {
      idempotencia.set(`${params[0]}|${params[1]}`, JSON.parse(params[3] as string));
      return { rows: [] };
    }

    if (sql.includes('SELECT id FROM tenants WHERE id')) {
      return { rows: tenants.has(params[0] as string) ? [{ id: params[0] }] : [] };
    }

    if (sql.includes('FROM usuarios WHERE email = $1 AND tenant_id = $2')) {
      const fila = usuarios.get(`${params[1]}|${params[0]}`);
      return { rows: fila ? [fila] : [] };
    }

    if (sql.includes('FROM usuarios WHERE email = $1 AND tenant_id <> $2')) {
      const encontrado = [...usuarios.values()].find((u) => u.email === params[0] && u.tenant_id !== params[1]);
      return { rows: encontrado ? [encontrado] : [] };
    }

    if (sql.startsWith('INSERT INTO usuarios')) {
      // VALUES ($1, NULL, $2, $3, $4, $5, $6, $7)
      const fila: UsuarioRow = {
        id: `usr-${siguiente++}`,
        tenant_id: params[0] as string,
        sucursal_id: null,
        nombre: params[1] as string,
        apellido: (params[2] as string | null) ?? null,
        email: params[3] as string,
        password_hash: params[4] as string,
        pin_hash: params[5] as string,
        rol: params[6] as string,
      };
      usuarios.set(`${fila.tenant_id}|${fila.email}`, fila);
      return { rows: [fila] };
    }

    throw new Error(`Query no contemplada en el fake: ${sql}`);
  };

  return {
    query,
    proyectarTenant: (tenantId: string) => tenants.add(tenantId),
    obtenerUsuario: (tenantId: string, email: string) => usuarios.get(`${tenantId}|${email}`),
    contarUsuarios: () => usuarios.size,
  };
};

const payloadBase = () => ({
  nombre: 'Admin Demo',
  apellido: 'Inicial',
  email: EMAIL,
  rol: 'administrador',
  password_hash: HASH_BCRYPT,
  pin_hash: HASH_BCRYPT,
});

const eventoBase = (sobre = {}) => ({
  operationId: OPERATION,
  tipoEvento: 'USUARIO_INICIAL',
  tenantId: TENANT,
  payload: payloadBase(),
  ...sobre,
});

test('USUARIO_INICIAL crea el usuario administrador del tenant (rol administrador = matriz completa)', async () => {
  const db = crearDbFake();
  db.proyectarTenant(TENANT);
  const servicio = crearServicioEventosProvisionFactory({ db });

  const resultado = await servicio.recibirEvento(eventoBase());

  assert.equal(resultado.status, 200);
  const usuario = db.obtenerUsuario(TENANT, EMAIL);
  assert.ok(usuario, 'el usuario se creó en el tenant');
  assert.equal(usuario.rol, 'administrador', 'rol administrador → todos los permisos por matriz default');
  assert.equal(usuario.sucursal_id, null, 'sin sucursal asignada (aún no hay proyección de sucursales)');
  assert.equal(usuario.password_hash, HASH_BCRYPT, 'se persiste el hash bcrypt, no el texto');
  assert.equal(usuario.apellido, 'Inicial');
  assert.equal(db.contarUsuarios(), 1);
});

test('USUARIO_INICIAL es idempotente: reenvío NO duplica el usuario', async () => {
  const db = crearDbFake();
  db.proyectarTenant(TENANT);
  const servicio = crearServicioEventosProvisionFactory({ db });

  const primero = await servicio.recibirEvento(eventoBase());
  const segundo = await servicio.recibirEvento(eventoBase());

  assert.equal(primero.status, 200);
  assert.equal(segundo.status, 200);
  assert.equal(db.contarUsuarios(), 1, 'no duplica aunque el usuario ya exista');
});

test('USUARIO_INICIAL rechaza el evento si el tenant aún no está proyectado (409 — outbox reintenta)', async () => {
  const db = crearDbFake();
  const servicio = crearServicioEventosProvisionFactory({ db });

  await assert.rejects(
    servicio.recibirEvento(eventoBase()),
    (err: unknown) =>
      (err as { status?: number }).status === 409 &&
      /proyectado/.test((err as { mensaje?: string }).mensaje ?? '')
  );
  assert.equal(db.contarUsuarios(), 0);
});

test('USUARIO_INICIAL rechaza el email si ya está en uso por OTRA empresa (aislamiento)', async () => {
  const db = crearDbFake();
  db.proyectarTenant(TENANT);
  db.proyectarTenant(OTRO_TENANT);
  const servicio = crearServicioEventosProvisionFactory({ db });

  // El email ya existe en otro tenant.
  await servicio.recibirEvento(eventoBase({ tenantId: OTRO_TENANT }));

  await assert.rejects(
    servicio.recibirEvento(eventoBase({ tenantId: TENANT })),
    (err: unknown) =>
      (err as { status?: number }).status === 409 &&
      /otra empresa/.test((err as { mensaje?: string }).mensaje ?? '')
  );
  assert.equal(db.obtenerUsuario(TENANT, EMAIL), undefined, 'no se crea el usuario en el segundo tenant');
  assert.equal(db.contarUsuarios(), 1);
});

test('recibirEventoSchema rechaza password/pin en claro (solo bcrypt cruzando la frontera)', () => {
  // Clave extra con el password en claro → Joi "not allowed" (fail-closed).
  const conPasswordPlano = recibirEventoSchema.validate({
    operation_id: OPERATION,
    tenant_id: TENANT,
    tipo_evento: 'USUARIO_INICIAL',
    payload: { ...payloadBase(), password: 'ClaveInicial123!' },
  });
  assert.ok(conPasswordPlano.error, 'password en claro como clave extra → rechazado');
  assert.ok(/is not allowed/.test(conPasswordPlano.error!.message), 'Joi rechaza claves no definidas');

  const conPinPlano = recibirEventoSchema.validate({
    operation_id: OPERATION,
    tenant_id: TENANT,
    tipo_evento: 'USUARIO_INICIAL',
    payload: { ...payloadBase(), pin: '123456' },
  });
  assert.ok(conPinPlano.error, 'pin en claro como clave extra → rechazado');

  // Solo se aceptan hashes bcrypt para password_hash/pin_hash.
  const conHashInvalido = recibirEventoSchema.validate({
    operation_id: OPERATION,
    tenant_id: TENANT,
    tipo_evento: 'USUARIO_INICIAL',
    payload: { ...payloadBase(), password_hash: 'ClaveInicial123!' },
  });
  assert.ok(conHashInvalido.error, 'password_hash no bcrypt → rechazado');

  const conPinFaltante = recibirEventoSchema.validate({
    operation_id: OPERATION,
    tenant_id: TENANT,
    tipo_evento: 'USUARIO_INICIAL',
    payload: { ...payloadBase(), pin_hash: undefined },
  });
  assert.ok(conPinFaltante.error, 'sin pin_hash → rechazado');
});