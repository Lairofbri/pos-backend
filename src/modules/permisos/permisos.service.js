// src/modules/permisos/permisos.service.js
// Lógica de negocio del módulo de permisos
// Ahora delega toda la lógica a funciones en PostgreSQL

const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const agruparPorModulo = (permisos) => {
  const modulos = {};
  for (const p of permisos) {
    if (!modulos[p.modulo]) modulos[p.modulo] = [];
    modulos[p.modulo].push(p);
  }
  return Object.entries(modulos).map(([modulo, permisos]) => ({ modulo, permisos }));
};

const listarCatalogo = async () => {
  const { rows } = await query(
    `SELECT id, codigo, nombre, descripcion, modulo AS grupo
     FROM permisos
     ORDER BY modulo, codigo`
  );
  return rows;
};

const obtenerPermisosRol = async ({ tenantId, rol }) => {
  const { rows } = await query('SELECT * FROM fn_permisos_rol($1, $2)', [rol, tenantId]);
  return agruparPorModulo(rows);
};

const actualizarPermisosRol = async ({ tenantId, rol, permisos }) => {
  for (const { codigo, activo } of permisos) {
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

const listarRoles = async () => {
  const { rows } = await query('SELECT unnest(fn_roles_validos()) AS rol');
  return rows.map(r => r.rol);
};

const resetearPermisosRol = async ({ tenantId, rol }) => {
  await query('CALL sp_resetear_permisos_rol($1, $2)', [rol, tenantId]);
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
