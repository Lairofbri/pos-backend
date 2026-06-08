// src/modules/menus/menus.service.js
// Menú dinámico del sidebar — filtrado por permisos del usuario

const { query } = require('../../config/database');

/**
 * Obtener menús del tenant filtrados por los permisos del usuario
 */
const obtenerMenus = async ({ tenantId, permisosUsuario }) => {
  const { rows } = await query(
    `SELECT id, parent_id, titulo, icono, ruta, orden, permiso_codigo
     FROM menus
     WHERE tenant_id = $1 AND activo = TRUE
     ORDER BY orden ASC, titulo ASC`,
    [tenantId]
  );

  const setPermisos = permisosUsuario ? new Set(permisosUsuario) : null;

  // Filtrar: si setPermisos es null (admin) no filtrar, si no, solo menús sin permiso o que el usuario tenga
  const filtrados = setPermisos === null
    ? rows
    : rows.filter(m => !m.permiso_codigo || setPermisos.has(m.permiso_codigo));

  // Armar árbol: raíces (parent_id IS NULL) + hijos
  const mapa = {};
  for (const m of filtrados) {
    m.children = [];
    mapa[m.id] = m;
  }

  const arbol = [];
  for (const m of filtrados) {
    if (m.parent_id && mapa[m.parent_id]) {
      mapa[m.parent_id].children.push(m);
    } else if (!m.parent_id) {
      arbol.push(m);
    }
  }

  // Limpiar campos internos del JSON de respuesta y eliminar padres sin hijos visibles
  const limpiar = (items) => items
    .map(({ parent_id, permiso_codigo, ...rest }) => {
      const children = rest.children ? limpiar(rest.children) : [];
      // Si es un contenedor (sin ruta) y no tiene hijos, ocultarlo
      if (!rest.ruta && children.length === 0) return null;
      return { ...rest, children };
    })
    .filter(Boolean);

  return limpiar(arbol);
};

module.exports = { obtenerMenus };
