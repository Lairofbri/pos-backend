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
const { query, verificarConexion } = require('../config/database');
const env = require('../config/env');
const logger = require('../utils/logger');

const TENANT_ID    = 'a0000000-0000-0000-0000-000000000001';
const SUCURSAL_ID  = 'b0000000-0000-0000-0000-000000000001';
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
