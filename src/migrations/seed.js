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
const logger = require('../utils/logger');

const TENANT_ID    = 'a0000000-0000-0000-0000-000000000001';
const SUCURSAL_ID  = 'b0000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL  = 'admin@demo.pos';
const ADMIN_PIN    = '1234';          // PIN rápido para estación
const ADMIN_PASS   = 'Admin123!';    // Password para panel web

// Permisos default por rol — definición centralizada
// true = viene activado por default para ese rol
const PERMISOS_DEFAULT = {
  administrador: {
    'ordenes.ver': true, 'ordenes.crear': true, 'ordenes.actualizar': true,
    'ordenes.anular': true, 'ordenes.descuento': true,
    'items.agregar': true, 'items.eliminar': true, 'items.estado': true,
    'mesas.administrar': true, 'pago.registrar': true, 'pago.anular': true,
    'caja.abrir': true, 'caja.cerrar': true, 'caja.movimientos': true, 'caja.historial': true,
    'productos.ver': true, 'productos.crear': true, 'productos.editar': true,
    'productos.desactivar': true, 'productos.stock': true,
    'categorias.crear': true, 'categorias.editar': true,
    'clientes.ver': true, 'clientes.crear': true, 'clientes.editar': true, 'clientes.desactivar': true,
    'usuarios.ver': true, 'usuarios.crear': true, 'usuarios.editar': true,
    'usuarios.reset-pin': true, 'roles.configurar': true,
    'reportes.ver': true, 'reportes.exportar': true,
  },
  gerente: {
    'ordenes.ver': true, 'ordenes.crear': true, 'ordenes.actualizar': true,
    'ordenes.anular': true, 'ordenes.descuento': true,
    'items.agregar': true, 'items.eliminar': true, 'items.estado': true,
    'mesas.administrar': true, 'pago.registrar': true, 'pago.anular': false,
    'caja.abrir': true, 'caja.cerrar': true, 'caja.movimientos': true, 'caja.historial': true,
    'productos.ver': true, 'productos.crear': true, 'productos.editar': true,
    'productos.desactivar': true, 'productos.stock': true,
    'categorias.crear': true, 'categorias.editar': true,
    'clientes.ver': true, 'clientes.crear': true, 'clientes.editar': true, 'clientes.desactivar': true,
    'usuarios.ver': true, 'usuarios.crear': false, 'usuarios.editar': true,
    'usuarios.reset-pin': true, 'roles.configurar': false,
    'reportes.ver': true, 'reportes.exportar': true,
  },
  cajero: {
    'ordenes.ver': true, 'ordenes.crear': true, 'ordenes.actualizar': true,
    'ordenes.anular': false, 'ordenes.descuento': false,
    'items.agregar': true, 'items.eliminar': true, 'items.estado': false,
    'mesas.administrar': false, 'pago.registrar': true, 'pago.anular': false,
    'caja.abrir': true, 'caja.cerrar': false, 'caja.movimientos': false, 'caja.historial': false,
    'productos.ver': true, 'productos.crear': false, 'productos.editar': false,
    'productos.desactivar': false, 'productos.stock': true,
    'categorias.crear': false, 'categorias.editar': false,
    'clientes.ver': true, 'clientes.crear': true, 'clientes.editar': false, 'clientes.desactivar': false,
    'usuarios.ver': false, 'usuarios.crear': false, 'usuarios.editar': false,
    'usuarios.reset-pin': false, 'roles.configurar': false,
    'reportes.ver': false, 'reportes.exportar': false,
  },
  mesero: {
    'ordenes.ver': true, 'ordenes.crear': false, 'ordenes.actualizar': false,
    'ordenes.anular': false, 'ordenes.descuento': false,
    'items.agregar': false, 'items.eliminar': false, 'items.estado': false,
    'mesas.administrar': false, 'pago.registrar': false, 'pago.anular': false,
    'caja.abrir': false, 'caja.cerrar': false, 'caja.movimientos': false, 'caja.historial': false,
    'productos.ver': true, 'productos.crear': false, 'productos.editar': false,
    'productos.desactivar': false, 'productos.stock': false,
    'categorias.crear': false, 'categorias.editar': false,
    'clientes.ver': false, 'clientes.crear': false, 'clientes.editar': false, 'clientes.desactivar': false,
    'usuarios.ver': false, 'usuarios.crear': false, 'usuarios.editar': false,
    'usuarios.reset-pin': false, 'roles.configurar': false,
    'reportes.ver': false, 'reportes.exportar': false,
  },
  cocinero: {
    'ordenes.ver': false, 'ordenes.crear': false, 'ordenes.actualizar': false,
    'ordenes.anular': false, 'ordenes.descuento': false,
    'items.agregar': false, 'items.eliminar': false, 'items.estado': true,
    'mesas.administrar': false, 'pago.registrar': false, 'pago.anular': false,
    'caja.abrir': false, 'caja.cerrar': false, 'caja.movimientos': false, 'caja.historial': false,
    'productos.ver': true, 'productos.crear': false, 'productos.editar': false,
    'productos.desactivar': false, 'productos.stock': false,
    'categorias.crear': false, 'categorias.editar': false,
    'clientes.ver': false, 'clientes.crear': false, 'clientes.editar': false, 'clientes.desactivar': false,
    'usuarios.ver': false, 'usuarios.crear': false, 'usuarios.editar': false,
    'usuarios.reset-pin': false, 'roles.configurar': false,
    'reportes.ver': false, 'reportes.exportar': false,
  },
};

/**
 * Inserta los permisos default para un tenant y rol específico.
 * Idempotente: usa ON CONFLICT DO NOTHING.
 * Exportada para usarse desde el endpoint de reset y creación de tenants.
 */
const sembrarPermisosRol = async (tenantId, rol) => {
  const permisos = PERMISOS_DEFAULT[rol];
  if (!permisos) {
    logger.warn(`Rol sin defaults definidos: ${rol}`);
    return;
  }

  for (const [codigo, activo] of Object.entries(permisos)) {
    await query(
      `INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
       SELECT $1, p.id, $2, $3
       FROM permisos p
       WHERE p.codigo = $4
       ON CONFLICT (rol, permiso_id, tenant_id) DO UPDATE SET activo = $3`,
      [rol, tenantId, activo, codigo]
    );
  }
};

/**
 * Inserta los permisos default para todos los roles de un tenant.
 */
const sembrarPermisosTenant = async (tenantId) => {
  const roles = Object.keys(PERMISOS_DEFAULT);
  for (const rol of roles) {
    await sembrarPermisosRol(tenantId, rol);
  }
  logger.info('Permisos default sembrados para tenant', { tenant_id: tenantId, roles: roles.length });
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

module.exports = { PERMISOS_DEFAULT, sembrarPermisosRol, sembrarPermisosTenant };
