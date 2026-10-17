// tests/unit/bloqueo-empresa.test.ts
// Pruebas unitarias de F2 — el POS deja de escribir empresa/sucursal
// (spec «DTE única fuente de verdad de empresa y sucursal», 2026-10-16).
//
// Criterio de salida de F2: "el POS no puede alterar identidad/config/sucursal;
// todo intento devuelve error explícito."
//
// Se cubre:
// - PUT /restaurante con campos de empresa → 409 con mensaje "se administra en
//   el DTE" (no se valida ni se persiste nada).
// - El servicio de restaurante también rechaza campos de empresa (defensa en
//   profundidad) y solo escribe `pos_default_mode`.
// - El schema Joi de PUT /restaurante ya no acepta campos de empresa.
// - POST /sucursales y PATCH /sucursales/:id → 409 con mensaje explícito.

import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { handler as actualizarRestauranteHandler } from '../../src/features/restaurante/actualizar/handler.js';
import { actualizarRestauranteSchema } from '../../src/features/restaurante/actualizar/request.js';
import { crearServicioRestauranteFactory } from '../../src/features/restaurante/actualizar/service.js';
import { handler as crearSucursalHandler } from '../../src/features/admin/sucursales/crear/handler.js';
import { handler as actualizarSucursalHandler } from '../../src/features/admin/sucursales/actualizar/handler.js';
import { MENSAJE_EMPRESA_SOLO_DTE, MENSAJE_SUCURSAL_ALTA_SOLO_DTE } from '../../src/shared/empresa.js';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const USUARIO = 'u0000000-0000-4000-8000-000000000001';

type RespuestaFake = {
  statusCode: number;
  body: { ok: boolean; mensaje: string; errores?: { campos: string[] } } | null;
};

const crearResFake = () => {
  const res: RespuestaFake & Pick<Response, 'status' | 'json'> = {
    statusCode: 0,
    body: null,
    status(codigo: number) {
      this.statusCode = codigo;
      return this as unknown as Response;
    },
    json(cuerpo: unknown) {
      this.body = cuerpo as RespuestaFake['body'];
      return this as unknown as Response;
    },
  };
  return res;
};

const crearReqFake = (body: Record<string, unknown>, metodo = 'PUT'): Request =>
  ({
    body,
    method: metodo,
    originalUrl: '/api/v1/restaurante',
    ip: '127.0.0.1',
    usuario: { id: USUARIO, tenant_id: TENANT },
  }) as unknown as Request;

test('PUT /restaurante rechaza identidad de empresa con 409 y mensaje explícito', async () => {
  const req = crearReqFake({ nombre: 'Empresa editada', nit: '0614-260967-101-5' });
  const res = crearResFake();

  await actualizarRestauranteHandler(req, res as unknown as Response);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body?.ok, false);
  assert.equal(res.body?.mensaje, MENSAJE_EMPRESA_SOLO_DTE);
  assert.deepEqual(res.body?.errores?.campos, ['nombre', 'nit']);
});

test('PUT /restaurante también bloquea logo_url/dirección mezclados con pos_default_mode', async () => {
  const req = crearReqFake({ logo_url: 'https://cdn.local/logo.png', pos_default_mode: 'rapido' });
  const res = crearResFake();

  await actualizarRestauranteHandler(req, res as unknown as Response);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body?.errores?.campos, ['logo_url']);
});

test('el schema Joi de PUT /restaurante ya no acepta campos de empresa', () => {
  const { error } = actualizarRestauranteSchema.validate({ nit: '0614-260967-101-5' });
  assert.ok(error, 'Joi debe rechazar campos de empresa');
});

test('el servicio de restaurante rechaza empresa sin tocar la BD y solo escribe pos_default_mode', async () => {
  const consultas: { sql: string; params: unknown[] }[] = [];
  const db = {
    query: async (sql: string, params: unknown[] = []) => {
      consultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      return {
        rows: [{ id: TENANT, pos_default_mode: 'rapido' }],
      };
    },
  };

  const servicio = crearServicioRestauranteFactory({ db });

  await assert.rejects(
    servicio.actualizarRestaurante({ tenantId: TENANT, datos: { nombre: 'Otra', nit: '123' } }),
    (err: { status?: number; mensaje?: string; campos?: string[] }) =>
      err.status === 409 && err.mensaje === MENSAJE_EMPRESA_SOLO_DTE && err.campos?.length === 2
  );
  assert.equal(consultas.length, 0, 'no debe ejecutar SQL al rechazar empresa');

  const fila = await servicio.actualizarRestaurante({ tenantId: TENANT, datos: { pos_default_mode: 'rapido' } });
  assert.equal(fila.pos_default_mode, 'rapido');
  assert.equal(consultas.length, 1);
  assert.ok(consultas[0].sql.startsWith('UPDATE tenants SET pos_default_mode = $1'));
  assert.deepEqual(consultas[0].params, ['rapido', TENANT]);
});

test('POST /sucursales está bloqueado (409) y no crea sucursales', async () => {
  const req = { ...crearReqFake({ nombre: 'Sucursal nueva' }, 'POST'), originalUrl: '/api/v1/sucursales' };
  const res = crearResFake();

  await crearSucursalHandler(req as Request, res as unknown as Response);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body?.mensaje, MENSAJE_SUCURSAL_ALTA_SOLO_DTE);
});

test('PATCH /sucursales/:id está bloqueado (409) y no edita la sucursal', async () => {
  const req = { ...crearReqFake({ nombre: 'Renombrada' }, 'PATCH'), originalUrl: '/api/v1/sucursales/x' };
  const res = crearResFake();

  await actualizarSucursalHandler(req as Request, res as unknown as Response);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body?.ok, false);
  assert.match(res.body?.mensaje ?? '', /se administra en el DTE Service/);
});
