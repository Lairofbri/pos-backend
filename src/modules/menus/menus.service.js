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

/**
 * Obtener un menú por ID
 */
const obtenerMenu = async ({ tenantId, menuId }) => {
  const { rows } = await query(
    `SELECT id, parent_id, titulo, icono, ruta, orden, permiso_codigo, activo
     FROM menus
     WHERE id = $1 AND tenant_id = $2`,
    [menuId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Menú no encontrado.' };
  }

  return rows[0];
};

/**
 * Crear un nuevo menú
 */
const crearMenu = async ({ tenantId, datos }) => {
  // Si tiene parent_id, verificar que exista en el mismo tenant
  if (datos.parent_id) {
    const { rows: parentRows } = await query(
      'SELECT id FROM menus WHERE id = $1 AND tenant_id = $2',
      [datos.parent_id, tenantId]
    );
    if (parentRows.length === 0) {
      throw { status: 404, mensaje: 'El menú padre indicado no existe.' };
    }
  }

  const { rows } = await query(
    `INSERT INTO menus (tenant_id, parent_id, titulo, icono, ruta, orden, permiso_codigo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, parent_id, titulo, icono, ruta, orden, permiso_codigo, activo`,
    [tenantId, datos.parent_id || null, datos.titulo, datos.icono || null, datos.ruta || null, datos.orden ?? 0, datos.permiso_codigo || null]
  );

  return rows[0];
};

/**
 * Actualizar un menú existente
 */
const actualizarMenu = async ({ tenantId, menuId, datos }) => {
  // Verificar que existe
  const { rows: existentes } = await query(
    'SELECT id FROM menus WHERE id = $1 AND tenant_id = $2',
    [menuId, tenantId]
  );
  if (existentes.length === 0) {
    throw { status: 404, mensaje: 'Menú no encontrado.' };
  }

  // Si se cambia parent_id, verificar que exista y no sea así mismo
  if (datos.parent_id) {
    if (datos.parent_id === menuId) {
      throw { status: 400, mensaje: 'Un menú no puede ser padre de sí mismo.' };
    }
    const { rows: parentRows } = await query(
      'SELECT id FROM menus WHERE id = $1 AND tenant_id = $2',
      [datos.parent_id, tenantId]
    );
    if (parentRows.length === 0) {
      throw { status: 404, mensaje: 'El menú padre indicado no existe.' };
    }
  }

  const campos = [];
  const valores = [];
  let idx = 1;

  for (const [col, val] of Object.entries(datos)) {
    campos.push(`${col} = $${idx}`);
    valores.push(val);
    idx++;
  }

  valores.push(menuId, tenantId);
  const { rows } = await query(
    `UPDATE menus SET ${campos.join(', ')}
     WHERE id = $${idx} AND tenant_id = $${idx + 1}
     RETURNING id, parent_id, titulo, icono, ruta, orden, permiso_codigo, activo`,
    valores
  );

  return rows[0];
};

/**
 * Desactivar (soft delete) un menú
 */
const desactivarMenu = async ({ tenantId, menuId }) => {
  const { rows } = await query(
    'SELECT id FROM menus WHERE id = $1 AND tenant_id = $2',
    [menuId, tenantId]
  );
  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Menú no encontrado.' };
  }

  await query(
    'UPDATE menus SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [menuId, tenantId]
  );
};

module.exports = { obtenerMenus, obtenerMenu, crearMenu, actualizarMenu, desactivarMenu };
