// tests/unit/empresa-dte.test.ts
// Pruebas unitarias de F3 — el POS lee EMPRESA y SUCURSAL del DTE Service
// (spec «DTE única fuente de verdad de empresa y sucursal» §4 F3).
//
// Criterios cubiertos:
// - La ficha de empresa se consulta server-a-servidor (endpoint interno).
// - El POS NO lee su tabla local: los mapeos salen del contrato del DTE.
// - Caché corta: no consulta dos veces dentro del TTL.
// - Degradación: si el DTE falla, se sirve la última copia buena (si existe);
//   sin copia previa, el error se propaga.
// - El establecimiento se resuelve por id canónico o por branch_id.
// - El login lista empresas + sucursales (fan-out tolerante a fallos).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearServicioEmpresaDteFactory,
  type ClienteDteGet,
  type EmpresaDte,
} from '../../src/shared/dte-empresa.js';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const EST_A = 'e0000000-0000-4000-8000-000000000001';
const EST_B = 'e0000000-0000-4000-8000-000000000002';
const BRANCH_A = 'b0000000-0000-4000-8000-000000000001';
const BRANCH_B = 'b0000000-0000-4000-8000-000000000002';

const empresaEjemplo: EmpresaDte = {
  tenant: {
    id: TENANT,
    nombre: 'Restaurante Demo SA de CV',
    nombre_comercial: 'Amber Demo',
    nit: '0614-260967-101-5',
    nrc: '123456-7',
    activo: true,
    provisioning_status: 'active',
    tiene_pos: true,
  },
  configuracion: {
    direccion: 'Av. Principal 123',
    telefono: '2200-0000',
    email: 'empresa@demo.sv',
    codigo_actividad: '56101',
    desc_actividad: 'Restaurantes',
    ambiente: '01',
    tiene_credenciales_hacienda: true,
    password_firma_configurada: true,
  },
  establecimientos: [
    {
      id: EST_A,
      branch_id: BRANCH_A,
      nombre: 'Sucursal Principal',
      direccion: 'Av. Principal 123',
      telefono: '2200-0000',
      email: null,
      es_principal: true,
      activo: true,
      cod_estable_mh: 'M001',
      cod_punto_venta_mh: 'P001',
      cod_estable: 'M001',
      cod_punto_venta: 'P001',
      tipo_establecimiento: '01',
      departamento_cod: '06',
      municipio_cod: '20',
      distrito_cod: null,
      fiscal_status: 'ready',
      provisioning_status: 'confirmed',
    },
    {
      id: EST_B,
      branch_id: BRANCH_B,
      nombre: 'Sucursal Centro',
      direccion: null,
      telefono: null,
      email: null,
      es_principal: false,
      activo: true,
      cod_estable_mh: 'M002',
      cod_punto_venta_mh: 'P002',
      cod_estable: 'M002',
      cod_punto_venta: 'P002',
      tipo_establecimiento: '02',
      departamento_cod: '06',
      municipio_cod: '21',
      distrito_cod: null,
      fiscal_status: 'pending_mh_data',
      provisioning_status: 'confirmed',
    },
  ],
};

type Llamadas = { interno: string[]; publico: string[] };

const crearClientesFake = (opciones: {
  empresa?: () => EmpresaDte | Promise<EmpresaDte>;
  tenants?: () => unknown;
  llamadas?: Llamadas;
} = {}) => {
  const llamadas: Llamadas = opciones.llamadas ?? { interno: [], publico: [] };

  const clienteInterno: ClienteDteGet = {
    get: async (url: string) => {
      llamadas.interno.push(url);
      return opciones.empresa ? await opciones.empresa() : empresaEjemplo;
    },
  };

  const clientePublico: ClienteDteGet = {
    get: async (url: string) => {
      llamadas.publico.push(url);
      return opciones.tenants
        ? await opciones.tenants()
        : [
            { id: TENANT, nombre: 'Restaurante Demo', nombre_comercial: 'Amber Demo', provisioning_status: 'active' },
          ];
    },
  };

  return {
    llamadas,
    crearClienteInterno: () => clienteInterno,
    crearClientePublico: () => clientePublico,
  };
};

test('obtenerEmpresa consulta el endpoint interno server-a-servidor y devuelve el contrato sin secretos', async () => {
  const clientes = crearClientesFake();
  const servicio = crearServicioEmpresaDteFactory({ ...clientes, baseURL: 'http://dte.test' });

  const empresa = await servicio.obtenerEmpresa(TENANT);

  assert.deepEqual(clientes.llamadas.interno, [`/internal/provisioning/tenants/${TENANT}/empresa`]);
  assert.equal(empresa.tenant.nit, '0614-260967-101-5');
  assert.equal(empresa.configuracion?.tiene_credenciales_hacienda, true);

  const serializado = JSON.stringify(empresa);
  for (const secreto of ['password_hacienda', 'usuario_hacienda', 'password_firma"', 'token_hacienda']) {
    assert.ok(!serializado.includes(secreto), `nunca debe exponer ${secreto}`);
  }
});

test('la caché evita consultar el DTE dos veces dentro del TTL', async () => {
  const clientes = crearClientesFake();
  const servicio = crearServicioEmpresaDteFactory({ ...clientes, ttlMs: 60_000 });

  await servicio.obtenerEmpresa(TENANT);
  await servicio.obtenerEmpresa(TENANT);

  assert.equal(clientes.llamadas.interno.length, 1);
});

test('degradación: si el DTE falla y hay copia en caché, se sirve la copia (stale)', async () => {
  let fallar = false;
  const clientes = crearClientesFake({
    empresa: () => {
      if (fallar) throw { status: 503, mensaje: 'DTE caído' };
      return empresaEjemplo;
    },
  });
  const servicio = crearServicioEmpresaDteFactory({ ...clientes, ttlMs: 0 });

  await servicio.obtenerEmpresa(TENANT);
  fallar = true;
  const empresa = await servicio.obtenerEmpresa(TENANT);

  assert.equal(empresa.tenant.id, TENANT);
  assert.equal(clientes.llamadas.interno.length, 2, 'intentó refrescar antes de degradar');
});

test('degradación: sin copia previa el error del DTE se propaga (503)', async () => {
  const clientes = crearClientesFake({
    empresa: () => {
      throw { status: 503, mensaje: 'DTE caído' };
    },
  });
  const servicio = crearServicioEmpresaDteFactory(clientes);

  await assert.rejects(
    servicio.obtenerEmpresa(TENANT),
    (err: { status?: number }) => err.status === 503
  );
});

test('listarEstablecimientos mapea el establecimiento del DTE y ordena la matriz primero', async () => {
  const clientes = crearClientesFake();
  const servicio = crearServicioEmpresaDteFactory(clientes);

  const sucursales = await servicio.listarEstablecimientos(TENANT);

  assert.equal(sucursales.length, 2);
  assert.equal(sucursales[0].nombre, 'Sucursal Principal');
  assert.equal(sucursales[0].es_principal, true);
  assert.equal(sucursales[0].id, EST_A, 'el id de la sucursal es el establecimiento canónico');
  assert.equal(sucursales[0].dte_establecimiento_id, EST_A);
  assert.equal(sucursales[0].branch_id, BRANCH_A);
  assert.equal(sucursales[0].tenant_id, TENANT);
  assert.equal(sucursales[0].fiscal_status, 'ready');
  assert.equal(sucursales[1].nombre, 'Sucursal Centro');
  assert.equal(sucursales[1].fiscal_status, 'pending_mh_data');
});

test('obtenerEstablecimiento devuelve 404 si el establecimiento no pertenece al tenant', async () => {
  const clientes = crearClientesFake();
  const servicio = crearServicioEmpresaDteFactory(clientes);

  const ok = await servicio.obtenerEstablecimiento(TENANT, EST_B);
  assert.equal(ok.id, EST_B);

  await assert.rejects(
    servicio.obtenerEstablecimiento(TENANT, 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
    (err: { status?: number }) => err.status === 404
  );
});

test('resolverEstablecimientoFiscal resuelve por id canónico y por branch_id', async () => {
  const servicio = crearServicioEmpresaDteFactory(crearClientesFake());

  const porId = await servicio.resolverEstablecimientoFiscal(TENANT, EST_B);
  assert.equal(porId?.dte_establecimiento_id, EST_B);
  assert.equal(porId?.branch_id, BRANCH_B);

  const porBranch = await servicio.resolverEstablecimientoFiscal(TENANT, BRANCH_A);
  assert.equal(porBranch?.dte_establecimiento_id, EST_A);
  assert.equal(porBranch?.fiscal_status, 'ready');

  const inexistente = await servicio.resolverEstablecimientoFiscal(TENANT, BRANCH_B + 'x');
  assert.equal(inexistente, null);
});

test('listarEmpresasParaLogin devuelve empresas + sucursales del DTE', async () => {
  const clientes = crearClientesFake();
  const servicio = crearServicioEmpresaDteFactory(clientes);

  const { tenants, sucursales } = await servicio.listarEmpresasParaLogin();

  assert.deepEqual(clientes.llamadas.publico, ['/api/tenants']);
  assert.equal(tenants.length, 1);
  assert.equal(tenants[0].id, TENANT);
  assert.equal(tenants[0].nombre_comercial, 'Amber Demo');
  assert.equal(tenants[0].fiscal_sync_status, 'active');
  assert.equal(sucursales.length, 2);
  assert.equal(sucursales[0].tenant_id, TENANT);
});

test('listarEmpresasParaLogin tolera que una empresa falle y lista las demás', async () => {
  const clientes = crearClientesFake({
    tenants: () => [
      { id: TENANT, nombre: 'Demo', nombre_comercial: null, provisioning_status: 'active' },
      { id: 'otro-tenant', nombre: 'Otra', nombre_comercial: null, provisioning_status: 'active' },
    ],
    empresa: () => empresaEjemplo,
  });

  // El segundo tenant falla siempre.
  const servicioConFallo = crearServicioEmpresaDteFactory({
    crearClientePublico: clientes.crearClientePublico,
    crearClienteInterno: () => ({
      get: async (url: string) => {
        if (url.includes('otro-tenant')) throw { status: 503, mensaje: 'DTE caído' };
        return empresaEjemplo;
      },
    }),
  });

  const { tenants, sucursales } = await servicioConFallo.listarEmpresasParaLogin();

  assert.equal(tenants.length, 2);
  assert.equal(sucursales.length, 2, 'solo las sucursales de la empresa disponible');
  assert.ok(sucursales.every((s) => s.tenant_id === TENANT));
});

test('obtenerDatosEmisor arma la identidad fiscal de la empresa (sin secretos)', async () => {
  const servicio = crearServicioEmpresaDteFactory(crearClientesFake());

  const emisor = await servicio.obtenerDatosEmisor(TENANT);

  assert.equal(emisor.nombre, 'Restaurante Demo SA de CV');
  assert.equal(emisor.nit, '0614-260967-101-5');
  assert.equal(emisor.nrc, '123456-7');
  assert.equal(emisor.direccion, 'Av. Principal 123');
  assert.equal(emisor.telefono, '2200-0000');
  assert.equal(emisor.email, 'empresa@demo.sv');
  assert.equal(emisor.logo_url, null);
});

test('mapaNombresEstablecimiento indexa por id y por branch_id', async () => {
  const servicio = crearServicioEmpresaDteFactory(crearClientesFake());

  const mapa = await servicio.mapaNombresEstablecimiento(TENANT);

  assert.equal(mapa.get(EST_A), 'Sucursal Principal');
  assert.equal(mapa.get(BRANCH_A), 'Sucursal Principal');
  assert.equal(mapa.get(EST_B), 'Sucursal Centro');
  assert.equal(mapa.get(BRANCH_B), 'Sucursal Centro');
  assert.equal(mapa.get('desconocido'), undefined);
});
