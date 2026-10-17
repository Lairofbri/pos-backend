// src/migrations/seed.js
// Crea los datos estructurales iniciales:
//   - Usuario administrador con email y PIN
//   - Permisos default por rol para el tenant
//   - Menús del sidebar
//   - Catálogos (unidades de medida, tipos de pago, etc.)
//   - Usuarios extra por rol (mesero, cajero, cocinero, gerente)
//
// Uso: node src/migrations/seed.js
// SOLO ejecutar una vez al inicio. Es idempotente (no duplica si ya existe).

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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
// Menú del sidebar
// ─────────────────────────────────────────────
//
// NOTA (migración 080, 2026-10-16): los menús del sidebar son un catálogo
// GLOBAL (tabla `menus` sin `tenant_id`), no varían por empresa y los crea la
// migración. El seed ya NO siembra menús por tenant.

// ─────────────────────────────
const sembrarUsuariosExtra = async (tenantId, sucursalId) => {
  const SALT_ROUNDS = 12;
  const usuarios = [
    { id: 'e0000000-0000-4000-8000-000000000001', nombre: 'Carlos',     apellido: 'Martínez',  email: 'mesero1@demo.pos', pin: '111111', rol: 'mesero' },
    { id: 'e0000000-0000-4000-8000-000000000002', nombre: 'María',      apellido: 'López',      email: 'mesero2@demo.pos', pin: '222222', rol: 'mesero' },
    { id: 'e0000000-0000-4000-8000-000000000003', nombre: 'Pedro',      apellido: 'Ramírez',    email: 'cajero1@demo.pos',  pin: '333333', rol: 'cajero' },
    { id: 'e0000000-0000-4000-8000-000000000004', nombre: 'Ana',        apellido: 'Hernández',  email: 'cocina1@demo.pos',  pin: '444444', rol: 'cocinero' },
    { id: 'e0000000-0000-4000-8000-000000000005', nombre: 'Roberto',    apellido: 'García',     email: 'gerente@demo.pos',  pin: '555555', rol: 'gerente' },
  ];

  for (const u of usuarios) {
    const pinHash = await bcrypt.hash(u.pin, SALT_ROUNDS);
    await query(
      `INSERT INTO usuarios (id, tenant_id, sucursal_id, nombre, apellido, email, pin_hash, rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido, rol = EXCLUDED.rol`,
      [u.id, tenantId, sucursalId, u.nombre, u.apellido, u.email, pinHash, u.rol]
    );
  }

  // Fase 2: usuario de plataforma (onboarding / alta de empresas).
  // Tiene password para login web; el PIN cubre el NOT NULL de pin_hash.
  const plataformaEmail = 'plataforma@demo.pos';
  const { rows: plataformaExistente } = await query(
    'SELECT id FROM usuarios WHERE email = $1',
    [plataformaEmail]
  );
  if (plataformaExistente.length === 0) {
    const passwordHash = await bcrypt.hash('Admin123!', SALT_ROUNDS);
    const pinHash = await bcrypt.hash('999999', SALT_ROUNDS);
    await query(
      `INSERT INTO usuarios (id, tenant_id, sucursal_id, nombre, apellido, email, password_hash, pin_hash, rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'plataforma') ON CONFLICT DO NOTHING`,
      [crypto.randomUUID(), tenantId, sucursalId, 'Plataforma', 'Demo', plataformaEmail, passwordHash, pinHash]
    );
    logger.info('Usuario plataforma sembrado', { tenant_id: tenantId });
  }
  logger.info('Usuarios extra sembrados', { tenant_id: tenantId, usuarios: usuarios.length });
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

  // 5. Menús del sidebar: catálogo GLOBAL (migración 080) — no se siembran por tenant.

  // 6. Sembrar catálogos default (siempre, idempotente)
  await query('CALL sp_sembrar_catalogos_tenant($1)', [TENANT_ID]);

  // 7. Sembrar usuarios extra (meseros, cajero, cocina, gerente)
  await sembrarUsuariosExtra(TENANT_ID, SUCURSAL_ID);

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

module.exports = { sembrarPermisosTenant, sembrarUsuariosExtra };
