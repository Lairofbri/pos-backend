// tests/unit/estado-fiscal.test.ts
// Pruebas unitarias de la consulta de estado fiscal POS ↔ DTE (Fase 4).
//
// Criterio de salida de Fase 4: "POS puede consultar estado fiscal, pero
// nunca leer ni modificar secretos Hacienda."
// Se verifica:
// - El servicio consulta el endpoint interno de LECTURA del DTE Service.
// - La respuesta viaja sin secretos Hacienda (password, usuario_hacienda,
//   token_hacienda) y no se persiste nada.
// - Los errores del DTE se propagan al cliente.
// - El receptor de eventos de provisión rechaza payloads que contengan
//   campos secretos (defensa en profundidad: Joi allowUnknown=false).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearServicioEstadoFiscalFactory,
  type EstadoFiscalDte,
} from '../../src/features/provisioning/estado-fiscal/service.js';
import { recibirEventoSchema } from '../../src/features/internal/provisioning/request.js';

const TENANT = 'a0000000-0000-4000-8000-000000000001';

const estadoEjemplo: EstadoFiscalDte = {
  tenant_id: TENANT,
  provisioning_status: 'pending_fiscal_setup',
  credenciales_hacienda: true,
  token_vigente: true,
  firma: {
    tenant_id: TENANT,
    nit: '0614-260967-101-5',
    estado: 'listo',
    firmador_disponible: true,
    credencial_firma_disponible: true,
  },
  establecimientos: [
    { establecimiento_id: 'e0000000-0000-4000-8000-000000000001', branch_id: 'b0000000-0000-4000-8000-000000000001', fiscal_status: 'ready', activo: true },
  ],
};

test('consultarEstadoFiscal llama al endpoint interno de lectura y devuelve el estado sin secretos', async () => {
  const llamadas: string[] = [];
  const cliente = {
    get: async (url: string) => {
      llamadas.push(url);
      return estadoEjemplo;
    },
  };

  const servicio = crearServicioEstadoFiscalFactory({
    crearClienteInterno: () => cliente as never,
  });

  const estado = await servicio.consultarEstadoFiscal({ tenantId: TENANT });

  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0], `/internal/provisioning/tenants/${TENANT}/estado-fiscal`);
  assert.equal(estado.tenant_id, TENANT);
  assert.equal(estado.provisioning_status, 'pending_fiscal_setup');
  assert.equal(estado.credenciales_hacienda, true);
  assert.equal(estado.firma.estado, 'listo');
  assert.equal(estado.establecimientos.length, 1);
  assert.equal(estado.establecimientos[0].fiscal_status, 'ready');

  const serializado = JSON.stringify(estado);
  assert.ok(!serializado.includes('password'), 'nunca expone password de Hacienda');
  assert.ok(!serializado.includes('usuario_hacienda'), 'nunca expone usuario de Hacienda');
  assert.ok(!serializado.includes('token_hacienda'), 'nunca expone el token de Hacienda');
});

test('consultarEstadoFiscal propaga errores del DTE Service (404 tenant inexistente)', async () => {
  const cliente = {
    get: async () => {
      throw { status: 404, mensaje: 'Tenant no encontrado.' };
    },
  };

  const servicio = crearServicioEstadoFiscalFactory({
    crearClienteInterno: () => cliente as never,
  });

  await assert.rejects(
    servicio.consultarEstadoFiscal({ tenantId: TENANT }),
    (err: { status?: number }) => err.status === 404
  );
});

test('el receptor de eventos POS rechaza payloads con secretos Hacienda (BRANCH_VINCULADO)', () => {
  const resultado = recibirEventoSchema.validate({
    operation_id: 'd0000000-0000-4000-8000-000000000001',
    tenant_id: TENANT,
    branch_id: 'b0000000-0000-4000-8000-000000000001',
    tipo_evento: 'BRANCH_VINCULADO',
    payload: {
      branch_id: 'b0000000-0000-4000-8000-000000000001',
      establecimiento_id: 'e0000000-0000-4000-8000-000000000001',
      fiscal_status: 'ready',
      nombre: 'Sucursal Norte',
      password_hacienda: 'supersecret',
      usuario_hacienda: 'usuario-mh',
    },
  });

  assert.ok(resultado.error, 'un evento con secretos debe ser rechazado');
  assert.ok(String(resultado.error.message).includes('password_hacienda'));
});

test('el receptor de eventos POS rechaza secretos en TENANT_CREADO', () => {
  const resultado = recibirEventoSchema.validate({
    operation_id: 'd0000000-0000-4000-8000-000000000001',
    tenant_id: TENANT,
    tipo_evento: 'TENANT_CREADO',
    payload: {
      nombre: 'Empresa Nueva',
      nit: '0614-260967-101-5',
      password: 'supersecret',
      token_hacienda: 'abc',
    },
  });

  assert.ok(resultado.error, 'un evento con secretos debe ser rechazado');
});

test('el receptor de eventos POS acepta payloads legítimos sin secretos', () => {
  const resultado = recibirEventoSchema.validate({
    operation_id: 'd0000000-0000-4000-8000-000000000001',
    tenant_id: TENANT,
    branch_id: 'b0000000-0000-4000-8000-000000000001',
    tipo_evento: 'BRANCH_VINCULADO',
    payload: {
      branch_id: 'b0000000-0000-4000-8000-000000000001',
      establecimiento_id: 'e0000000-0000-4000-8000-000000000001',
      fiscal_status: 'ready',
      nombre: 'Sucursal Norte',
      direccion: 'Av. Norte 123',
      cod_estable_mh: 'M001',
      cod_punto_venta_mh: 'P001',
    },
  });

  assert.equal(resultado.error, undefined);
  assert.equal(resultado.value.password_hacienda, undefined);
  assert.equal(resultado.value.payload.password_hacienda, undefined);
});