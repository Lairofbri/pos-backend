// src/migrations/seed.js
// Crea los datos iniciales de demostración:
//   - Tenant "Restaurante Demo"
//   - Sucursal Principal
//   - Usuario administrador con email y PIN
//   - Permisos default por rol para el tenant demo
//
// Uso: node src/migrations/seed.js
// SOLO ejecutar una vez al inicio. Es idempotente (no duplica si ya existe).

const bcrypt = require('bcryptjs');
const { query, verificarConexion } = require('../shared/config/database.js');
const { env } = require('../shared/config/env.js');
const { logger } = require('../shared/utils/logger.js');

const TENANT_ID    = 'a0000000-0000-4000-8000-000000000001';
const SUCURSAL_ID  = 'b0000000-0000-4000-8000-000000000001';
const ADMIN_EMAIL  = 'admin@demo.pos';
const ADMIN_PIN    = '123456';        // PIN rápido para estación
const ADMIN_PASS   = 'Admin123!';    // Password para panel web

if (env.ES_PRODUCCION) {
  logger.error('Seed bloqueado: no puede ejecutarse en producción.');
  process.exit(1);
}

/**
 * Inserta los permisos default para un tenant (delegado a sp_sembrar_permisos_tenant)
 */
const sembrarPermisosTenant = async (tenantId) => {
  await query('CALL sp_sembrar_permisos_tenant($1)', [tenantId]);
  logger.info('Permisos default sembrados para tenant', { tenant_id: tenantId });
};

// ─────────────────────────────────────────────
// Menú dinámico del sidebar
// ─────────────────────────────────────────────

/**
 * Inserta los menús default para un tenant
 * Usa IDs fijos para que el seed sea idempotente
 */
const sembrarMenusTenant = async (tenantId) => {
  const menus = [
    // Raíces
    { id: '00000000-0000-4000-8000-000000000001', parent_id: null, titulo: 'POS',             icono: 'shopping-cart', ruta: '/pos',                orden: 1, permiso_codigo: 'ordenes.ver' },
    { id: '00000000-0000-4000-8000-000000000002', parent_id: null, titulo: 'Cocina',          icono: 'chef-hat',      ruta: '/cocina',             orden: 2, permiso_codigo: 'items.estado' },
    { id: '00000000-0000-4000-8000-000000000003', parent_id: null, titulo: 'Administración',  icono: 'user-cog',      ruta: null,                   orden: 3, permiso_codigo: null },
    { id: 'cc306641-6ab2-4bfa-814f-528c4cbe2a65', parent_id: null, titulo: 'Principal',      icono: 'utensils',      ruta: null,                   orden: 1, permiso_codigo: null },
    { id: '00000000-0000-4000-8000-000000000010', parent_id: null, titulo: 'Configuraciones', icono: 'settings',      ruta: null,                   orden: 4, permiso_codigo: null },

    // Hijos de Administración
    { id: '9f3f836b-82f0-452f-b524-5e3bc54e4318', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Mesas',      icono: 'table',       ruta: '/admin/mesas',      orden: 1, permiso_codigo: 'mesas.administrar' },
    { id: '00000000-0000-4000-8000-000000000005', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Combos',     icono: 'gift',        ruta: '/admin/combos',     orden: 2, permiso_codigo: null },
    { id: '00000000-0000-4000-8000-000000000004', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Productos',  icono: 'package',     ruta: '/admin/productos',  orden: 3, permiso_codigo: 'productos.ver' },
    { id: '00000000-0000-4000-8000-000000000008', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Caja',       icono: 'dollar-sign', ruta: '/admin/caja',       orden: 5, permiso_codigo: 'caja.historial' },
      { id: '00000000-0000-4000-8000-000000000009', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Clientes',   icono: 'users',       ruta: '/admin/clientes',   orden: 6, permiso_codigo: 'clientes.ver' },
      { id: '00000000-0000-4000-8000-000000000012', parent_id: '00000000-0000-4000-8000-000000000003', titulo: 'Impresoras', icono: 'printer',     ruta: '/admin/impresoras', orden: 7, permiso_codigo: 'impresion.configurar' },

    // Hijos de Configuraciones
    { id: '00000000-0000-4000-8000-000000000011', parent_id: '00000000-0000-4000-8000-000000000010', titulo: 'Menú',           icono: 'menu',   ruta: '/configuraciones/menus', orden: 1, permiso_codigo: 'roles.configurar' },
    { id: '00000000-0000-4000-8000-000000000007', parent_id: '00000000-0000-4000-8000-000000000010', titulo: 'Roles y Permisos', icono: 'shield', ruta: '/configuraciones/roles', orden: 2, permiso_codigo: 'roles.configurar' },
    { id: '00000000-0000-4000-8000-000000000006', parent_id: '00000000-0000-4000-8000-000000000010', titulo: 'Usuarios',        icono: 'users',  ruta: '/configuraciones/usuarios', orden: 4, permiso_codigo: 'usuarios.ver' },
  ];

  for (const m of menus) {
    await query(
      `INSERT INTO menus (id, tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         titulo = EXCLUDED.titulo,
         icono = EXCLUDED.icono,
         ruta = EXCLUDED.ruta,
         orden = EXCLUDED.orden,
         permiso_codigo = EXCLUDED.permiso_codigo`,
      [m.id, tenantId, m.parent_id, m.titulo, m.icono, m.ruta, m.orden, m.permiso_codigo]
    );
  }

  logger.info('Menús default sembrados para tenant', { tenant_id: tenantId, menus: menus.length });
};

const sembrarCategorias = async (tenantId) => {
  const categorias = [
    { id: 'c0000000-0000-4000-8000-000000000001', nombre: 'Entradas',       orden: 1, color: '#FF6B6B' },
    { id: 'c0000000-0000-4000-8000-000000000002', nombre: 'Platos fuertes', orden: 2, color: '#4ECDC4' },
    { id: 'c0000000-0000-4000-8000-000000000003', nombre: 'Bebidas',        orden: 3, color: '#45B7D1' },
    { id: 'c0000000-0000-4000-8000-000000000004', nombre: 'Postres',        orden: 4, color: '#96CEB4' },
    { id: 'c0000000-0000-4000-8000-000000000005', nombre: 'Combos',         orden: 5, color: '#F9CA24' },
  ];

  for (const c of categorias) {
    await query(
      `INSERT INTO categorias (id, tenant_id, nombre, orden, color)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         orden = EXCLUDED.orden,
         color = EXCLUDED.color`,
      [c.id, tenantId, c.nombre, c.orden, c.color]
    );
  }
  logger.info('Categorías sembradas', { tenant_id: tenantId, categorias: categorias.length });
};

const sembrarProductos = async (tenantId) => {
  const productos = [
    { nombre: 'Sopa del día',       precio: 3.50,  categoria_id: 'c0000000-0000-4000-8000-000000000001', orden: 1 },
    { nombre: 'Ensalada mixta',     precio: 4.00,  categoria_id: 'c0000000-0000-4000-8000-000000000001', orden: 2 },
    { nombre: 'Ceviche de camarón', precio: 5.50,  categoria_id: 'c0000000-0000-4000-8000-000000000001', orden: 3 },
    { nombre: 'Pollo a la plancha', precio: 8.50,  categoria_id: 'c0000000-0000-4000-8000-000000000002', orden: 1 },
    { nombre: 'Carne asada',        precio: 12.00, categoria_id: 'c0000000-0000-4000-8000-000000000002', orden: 2 },
    { nombre: 'Pasta al pesto',     precio: 7.50,  categoria_id: 'c0000000-0000-4000-8000-000000000002', orden: 3 },
    { nombre: 'Pupusas revueltas',  precio: 2.50,  categoria_id: 'c0000000-0000-4000-8000-000000000002', orden: 4 },
    { nombre: 'Agua natural',       precio: 1.00,  categoria_id: 'c0000000-0000-4000-8000-000000000003', orden: 1 },
    { nombre: 'Refresco',           precio: 1.50,  categoria_id: 'c0000000-0000-4000-8000-000000000003', orden: 2 },
    { nombre: 'Jugo natural',       precio: 2.50,  categoria_id: 'c0000000-0000-4000-8000-000000000003', orden: 3 },
    { nombre: 'Café',               precio: 1.75,  categoria_id: 'c0000000-0000-4000-8000-000000000003', orden: 4 },
    { nombre: 'Flan',               precio: 2.50,  categoria_id: 'c0000000-0000-4000-8000-000000000004', orden: 1 },
    { nombre: 'Pastel del día',     precio: 3.00,  categoria_id: 'c0000000-0000-4000-8000-000000000004', orden: 2 },
    { nombre: 'Helado',             precio: 2.00,  categoria_id: 'c0000000-0000-4000-8000-000000000004', orden: 3 },
  ];

  for (const p of productos) {
    await query(
      `INSERT INTO productos (tenant_id, categoria_id, nombre, precio, orden)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [tenantId, p.categoria_id, p.nombre, p.precio, p.orden]
    );
  }
  logger.info('Productos sembrados', { tenant_id: tenantId, productos: productos.length });
};

const sembrarMesas = async (tenantId, sucursalId) => {
  const mesas = [
    { numero: '1',  nombre: 'Mesa 1',  capacidad: 4 },
    { numero: '2',  nombre: 'Mesa 2',  capacidad: 4 },
    { numero: '3',  nombre: 'Mesa 3',  capacidad: 6 },
    { numero: '4',  nombre: 'Mesa 4',  capacidad: 2 },
    { numero: '5',  nombre: 'Mesa 5',  capacidad: 8 },
    { numero: 'B1', nombre: 'Barra 1', capacidad: 1 },
    { numero: 'B2', nombre: 'Barra 2', capacidad: 1 },
    { numero: 'T1', nombre: 'Terraza 1', capacidad: 4 },
    { numero: 'T2', nombre: 'Terraza 2', capacidad: 4 },
    { numero: 'V1', nombre: 'VIP 1',   capacidad: 6 },
  ];

  for (const m of mesas) {
    await query(
      `INSERT INTO mesas (tenant_id, sucursal_id, numero, nombre, capacidad, estado)
       VALUES ($1, $2, $3, $4, $5, 'disponible')
       ON CONFLICT (tenant_id, numero) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         capacidad = EXCLUDED.capacidad`,
      [tenantId, sucursalId, m.numero, m.nombre, m.capacidad]
    );
  }
  logger.info('Mesas sembradas', { tenant_id: tenantId, mesas: mesas.length });
};

const sembrarCombos = async (tenantId) => {
  const combos = [
    { id: 'd0000000-0000-4000-8000-000000000001', nombre: 'Combo Familiar',  precio: 7.00 },
    { id: 'd0000000-0000-4000-8000-000000000002', nombre: 'Combo Ejecutivo', precio: 10.00 },
    { id: 'd0000000-0000-4000-8000-000000000003', nombre: 'Combo Infantil',  precio: 5.50 },
  ];

  for (const c of combos) {
    await query(
      `INSERT INTO combos (id, tenant_id, nombre, precio, activo)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (id) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         precio = EXCLUDED.precio`,
      [c.id, tenantId, c.nombre, c.precio]
    );
  }

  const { rows: productos } = await query(
    'SELECT id, nombre FROM productos WHERE tenant_id = $1',
    [tenantId]
  );
  const prodMap = Object.fromEntries(productos.map((p) => [p.nombre, p.id]));

  const comboProductos = [
    { combo_id: 'd0000000-0000-4000-8000-000000000001', nombre: 'Pupusas revueltas', cantidad: 2 },
    { combo_id: 'd0000000-0000-4000-8000-000000000001', nombre: 'Refresco',           cantidad: 2 },
    { combo_id: 'd0000000-0000-4000-8000-000000000002', nombre: 'Pollo a la plancha', cantidad: 1 },
    { combo_id: 'd0000000-0000-4000-8000-000000000002', nombre: 'Ensalada mixta',     cantidad: 1 },
    { combo_id: 'd0000000-0000-4000-8000-000000000002', nombre: 'Jugo natural',       cantidad: 1 },
    { combo_id: 'd0000000-0000-4000-8000-000000000003', nombre: 'Pasta al pesto',     cantidad: 1 },
    { combo_id: 'd0000000-0000-4000-8000-000000000003', nombre: 'Refresco',           cantidad: 1 },
    { combo_id: 'd0000000-0000-4000-8000-000000000003', nombre: 'Helado',             cantidad: 1 },
  ];

  for (const cp of comboProductos) {
    const productoId = prodMap[cp.nombre];
    if (!productoId) {
      logger.warn(`Producto no encontrado para combo: ${cp.nombre}`);
      continue;
    }
    await query(
      `INSERT INTO combo_productos (combo_id, producto_id, cantidad, tenant_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [cp.combo_id, productoId, cp.cantidad, tenantId]
    );
  }
  logger.info('Combos sembrados', { tenant_id: tenantId, combos: combos.length });
};

const ejecutarSeed = async () => {
  logger.info('Iniciando seed de datos iniciales...');
  await verificarConexion();

  // 1. Verificar si ya existe el admin
  const { rows } = await query(
    'SELECT id FROM usuarios WHERE email = $1',
    [ADMIN_EMAIL]
  );

  const adminExistente = rows.length > 0;

  if (!adminExistente) {
    // 2. Generar hashes
    const SALT_ROUNDS = 12;
    const pinHash      = await bcrypt.hash(ADMIN_PIN, SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(ADMIN_PASS, SALT_ROUNDS);

    // 3. Insertar usuario administrador
    await query(
      `INSERT INTO usuarios
         (tenant_id, sucursal_id, nombre, apellido, email, password_hash, pin_hash, rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'administrador')`,
      [
        TENANT_ID,
        SUCURSAL_ID,
        'Admin',
        'Demo',
        ADMIN_EMAIL,
        passwordHash,
        pinHash,
      ]
    );
  }

  // 4. Sembrar permisos default para los 5 roles del tenant demo (siempre, idempotente)
  await sembrarPermisosTenant(TENANT_ID);

  // 5. Sembrar menús default del sidebar (siempre, idempotente)
  await sembrarMenusTenant(TENANT_ID);

  // 6. Sembrar catálogos default (siempre, idempotente)
  await query('CALL sp_sembrar_catalogos_tenant($1)', [TENANT_ID]);

  // 7. Sembrar categorías de ejemplo
  await sembrarCategorias(TENANT_ID);

  // 8. Sembrar productos de ejemplo
  await sembrarProductos(TENANT_ID);

  // 9. Sembrar mesas de ejemplo
  await sembrarMesas(TENANT_ID, SUCURSAL_ID);

  // 10. Sembrar combos de ejemplo
  await sembrarCombos(TENANT_ID);

  logger.info('Seed completado exitosamente.');
  logger.info('─────────────────────────────────────');
  logger.info('Credenciales del administrador demo:');
  logger.info(`  Email:    ${ADMIN_EMAIL}`);
  logger.info(`  Password: ${ADMIN_PASS}`);
  logger.info(`  PIN:      ${ADMIN_PIN}`);
  logger.info('─────────────────────────────────────');
  logger.warn('IMPORTANTE: Cambia estas credenciales antes de producción.');

  process.exit(0);
};

// Solo ejecutar cuando se corre directamente (node src/migrations/seed.js),
// no cuando es importado como módulo por otro archivo
if (require.main === module) {
  ejecutarSeed().catch((err) => {
    logger.error('Error en seed', { error: err.message });
    process.exit(1);
  });
}

module.exports = { sembrarPermisosTenant, sembrarMenusTenant };
