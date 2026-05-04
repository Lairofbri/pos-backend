// src/migrations/seed.js
// Crea los datos iniciales de demostración:
//   - Tenant "Restaurante Demo"
//   - Sucursal Principal
//   - Usuario administrador con email y PIN
//
// Uso: node src/migrations/seed.js
// SOLO ejecutar una vez al inicio. Es idempotente (no duplica si ya existe).

const bcrypt = require('bcryptjs');
const { query, verificarConexion } = require('../config/database');
const logger = require('../utils/logger');

const TENANT_ID    = 'a0000000-0000-0000-0000-000000000001';
const SUCURSAL_ID  = 'b0000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL  = 'admin@demo.pos';
const ADMIN_PIN    = '1234';          // PIN rápido para estación
const ADMIN_PASS   = 'Admin123!';    // Password para panel web

const ejecutarSeed = async () => {
  logger.info('Iniciando seed de datos iniciales...');
  await verificarConexion();

  // 1. Verificar si ya existe el admin
  const { rows } = await query(
    'SELECT id FROM usuarios WHERE email = $1',
    [ADMIN_EMAIL]
  );

  if (rows.length > 0) {
    logger.info('Seed ya ejecutado anteriormente. No se crearon duplicados.');
    process.exit(0);
  }

  // 2. Generar hashes
  const SALT_ROUNDS = 10;
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

ejecutarSeed().catch((err) => {
  logger.error('Error en seed', { error: err.message });
  process.exit(1);
});
