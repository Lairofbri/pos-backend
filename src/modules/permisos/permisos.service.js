// src/modules/permisos/permisos.service.js
// Lógica de negocio del módulo de permisos
// Principio S (SOLID): solo opera con datos, no valida ni responde HTTP

const { query } = require('../../config/database');
const { sembrarPermisosRol } = require('../../migrations/seed');
const logger = require('../../utils/logger');

// Catálogo estático de permisos — fuente de verdad
// Debe coincidir con lo insertado en 007_permisos.sql
const CATALOGO = [
  { modulo: 'pos',       codigo: 'ordenes.ver',         nombre: 'Ver órdenes' },
  { modulo: 'pos',       codigo: 'ordenes.crear',       nombre: 'Crear orden' },
  { modulo: 'pos',       codigo: 'ordenes.actualizar',  nombre: 'Modificar orden' },
  { modulo: 'pos',       codigo: 'ordenes.anular',      nombre: 'Anular orden' },
  { modulo: 'pos',       codigo: 'ordenes.descuento',   nombre: 'Aplicar descuento' },
  { modulo: 'pos',       codigo: 'items.agregar',       nombre: 'Agregar items' },
  { modulo: 'pos',       codigo: 'items.eliminar',      nombre: 'Eliminar items' },
  { modulo: 'pos',       codigo: 'items.estado',        nombre: 'Cambiar estado de item' },
  { modulo: 'pos',       codigo: 'mesas.administrar',   nombre: 'Administrar mesas' },
  { modulo: 'pos',       codigo: 'pago.registrar',      nombre: 'Registrar pago' },
  { modulo: 'pos',       codigo: 'pago.anular',         nombre: 'Anular pago' },
  { modulo: 'caja',      codigo: 'caja.abrir',          nombre: 'Abrir caja' },
  { modulo: 'caja',      codigo: 'caja.cerrar',         nombre: 'Cerrar caja' },
  { modulo: 'caja',      codigo: 'caja.movimientos',    nombre: 'Registrar movimientos' },
  { modulo: 'caja',      codigo: 'caja.historial',      nombre: 'Ver historial de cajas' },
  { modulo: 'productos', codigo: 'productos.ver',       nombre: 'Ver productos' },
  { modulo: 'productos', codigo: 'productos.crear',     nombre: 'Crear productos' },
  { modulo: 'productos', codigo: 'productos.editar',    nombre: 'Editar productos' },
  { modulo: 'productos', codigo: 'productos.desactivar',nombre: 'Desactivar productos' },
  { modulo: 'productos', codigo: 'productos.stock',     nombre: 'Ajustar stock' },
  { modulo: 'productos', codigo: 'categorias.crear',    nombre: 'Crear categorías' },
  { modulo: 'productos', codigo: 'categorias.editar',   nombre: 'Editar categorías' },
  { modulo: 'clientes',  codigo: 'clientes.ver',        nombre: 'Ver clientes' },
  { modulo: 'clientes',  codigo: 'clientes.crear',      nombre: 'Crear clientes' },
  { modulo: 'clientes',  codigo: 'clientes.editar',     nombre: 'Editar clientes' },
  { modulo: 'clientes',  codigo: 'clientes.desactivar', nombre: 'Desactivar clientes' },
  { modulo: 'usuarios',  codigo: 'usuarios.ver',        nombre: 'Ver usuarios' },
  { modulo: 'usuarios',  codigo: 'usuarios.crear',      nombre: 'Crear usuarios' },
  { modulo: 'usuarios',  codigo: 'usuarios.editar',     nombre: 'Editar usuarios' },
  { modulo: 'usuarios',  codigo: 'usuarios.reset-pin',  nombre: 'Resetear PIN' },
  { modulo: 'usuarios',  codigo: 'roles.configurar',    nombre: 'Configurar roles' },
  { modulo: 'reportes',  codigo: 'reportes.ver',        nombre: 'Ver reportes' },
  { modulo: 'reportes',  codigo: 'reportes.exportar',   nombre: 'Exportar reportes' },
];

const ROLES_VALIDOS = ['administrador', 'gerente', 'cajero', 'mesero', 'cocinero'];

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

const agruparPorModulo = (permisos) => {
  const modulos = {};
  for (const p of permisos) {
    if (!modulos[p.modulo]) modulos[p.modulo] = [];
    modulos[p.modulo].push(p);
  }
  return Object.entries(modulos).map(([modulo, permisos]) => ({ modulo, permisos }));
};

// ─────────────────────────────────────────────
// MÉTODOS DEL SERVICE
// ─────────────────────────────────────────────

/**
 * Listar catálogo completo de permisos (sin estado activo)
 */
const listarCatalogo = async () => {
  return agruparPorModulo(CATALOGO.map(p => ({
    codigo: p.codigo,
    nombre: p.nombre,
  })));
};

/**
 * Listar permisos de un rol específico en el tenant, con estado activo
 */
const obtenerPermisosRol = async ({ tenantId, rol }) => {
  if (!ROLES_VALIDOS.includes(rol)) {
    throw { status: 400, mensaje: `Rol inválido. Debe ser: ${ROLES_VALIDOS.join(', ')}.` };
  }

  // Obtener estado actual desde BD
  const { rows } = await query(
    `SELECT p.codigo, rp.activo
     FROM permisos p
     LEFT JOIN rol_permisos rp ON rp.permiso_id = p.id
       AND rp.rol = $1 AND rp.tenant_id = $2
     ORDER BY p.modulo, p.codigo`,
    [rol, tenantId]
  );

  const estadoPorCodigo = {};
  for (const r of rows) {
    estadoPorCodigo[r.codigo] = r.activo === true;
  }

  // Merge con catálogo estático
  const permisos = CATALOGO.map(p => ({
    codigo: p.codigo,
    nombre: p.nombre,
    activo: estadoPorCodigo[p.codigo] ?? false,
  }));

  return agruparPorModulo(permisos);
};

/**
 * Actualizar permisos de un rol en el tenant (upsert)
 */
const actualizarPermisosRol = async ({ tenantId, rol, permisos }) => {
  if (!ROLES_VALIDOS.includes(rol)) {
    throw { status: 400, mensaje: `Rol inválido. Debe ser: ${ROLES_VALIDOS.join(', ')}.` };
  }

  const codigosValidos = new Set(CATALOGO.map(p => p.codigo));

  for (const { codigo, activo } of permisos) {
    if (!codigosValidos.has(codigo)) {
      throw { status: 400, mensaje: `Código de permiso no válido: ${codigo}` };
    }

    await query(
      `INSERT INTO rol_permisos (rol, permiso_id, tenant_id, activo)
       SELECT $1, p.id, $2, $3
       FROM permisos p
       WHERE p.codigo = $4
       ON CONFLICT (rol, permiso_id, tenant_id) DO UPDATE SET activo = $3`,
      [rol, tenantId, activo, codigo]
    );
  }

  logger.info('Permisos actualizados', { tenant_id: tenantId, rol, cambios: permisos.length });

  return obtenerPermisosRol({ tenantId, rol });
};

/**
 * Listar roles disponibles (estático)
 */
const listarRoles = async () => {
  return ROLES_VALIDOS;
};

/**
 * Resetear permisos de un rol a defaults
 */
const resetearPermisosRol = async ({ tenantId, rol }) => {
  if (!ROLES_VALIDOS.includes(rol)) {
    throw { status: 400, mensaje: `Rol inválido. Debe ser: ${ROLES_VALIDOS.join(', ')}.` };
  }

  await sembrarPermisosRol(tenantId, rol);

  logger.info('Permisos reseteados a defaults', { tenant_id: tenantId, rol });

  return obtenerPermisosRol({ tenantId, rol });
};

module.exports = {
  listarCatalogo,
  obtenerPermisosRol,
  actualizarPermisosRol,
  listarRoles,
  resetearPermisosRol,
};
