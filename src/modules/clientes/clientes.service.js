// src/modules/clientes/clientes.service.js
// Lógica de negocio del módulo de clientes
// Principio S (SOLID): solo opera con datos, no valida ni responde HTTP

const { query } = require('../../config/database');
const logger    = require('../../utils/logger');

// ─────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────

/**
 * Normaliza texto eliminando acentos para búsqueda flexible
 * Se aplica en Node.js para no depender de extensiones de PostgreSQL
 * Ej: "martinez" encuentra "Martínez", "garcia" encuentra "García"
 */
const normalizarTexto = (texto) => {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

/**
 * Formatea un cliente para la respuesta
 * Construye el nombre completo y determina si es persona jurídica
 */
const formatearCliente = (row) => ({
  ...row,
  nombre_completo: row.razon_social || `${row.nombre}${row.apellido ? ' ' + row.apellido : ''}`,
  es_empresa:      !!row.razon_social,
});

// ─────────────────────────────────────────────
// MÉTODOS DEL SERVICE
// ─────────────────────────────────────────────

/**
 * Listar clientes con filtros y paginación
 */
const listarClientes = async ({ tenantId, filtros = {} }) => {
  const { q, activo, pagina = 1, limite = 20 } = filtros;

  const condiciones = ['tenant_id = $1'];
  const valores     = [tenantId];
  let idx = 2;

  if (activo !== undefined) {
    condiciones.push(`activo = $${idx++}`);
    valores.push(activo);
  }

  // Búsqueda flexible — normalizar término en Node.js antes de enviar a PostgreSQL
  if (q && q.trim()) {
    const termino = normalizarTexto(q);
    condiciones.push(`(
      nombre           ILIKE $${idx} OR
      apellido         ILIKE $${idx} OR
      razon_social     ILIKE $${idx} OR
      nit              ILIKE $${idx} OR
      nrc              ILIKE $${idx} OR
      numero_documento ILIKE $${idx} OR
      telefono         ILIKE $${idx}
    )`);
    valores.push(`%${termino}%`);
    idx++;
  }

  const offset = (pagina - 1) * limite;

  const { rows } = await query(
    `SELECT
       id, nombre, apellido, telefono, email,
       tipo_documento, numero_documento,
       nit, nrc, razon_social,
       direccion, municipio, departamento,
       activo, creado_en
     FROM clientes
     WHERE ${condiciones.join(' AND ')}
     ORDER BY nombre ASC, apellido ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total FROM clientes WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    clientes: rows.map(formatearCliente),
    paginacion: {
      total:   parseInt(conteo[0].total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt(conteo[0].total) / limite),
    },
  };
};

/**
 * Búsqueda rápida para el POS al momento de facturar
 * Devuelve máximo 10 resultados
 * Normalización sin acentos en Node.js
 */
const buscarClientes = async ({ tenantId, q }) => {
  if (!q || q.trim().length < 2) {
    throw { status: 400, mensaje: 'Ingresa al menos 2 caracteres para buscar.' };
  }

  // Normalizar término en Node.js — elimina acentos antes de comparar
  const termino = normalizarTexto(q);

  const { rows } = await query(
    `SELECT
       id, nombre, apellido, razon_social,
       nit, nrc, numero_documento, tipo_documento,
       telefono, direccion
     FROM clientes
     WHERE tenant_id = $1
       AND activo = TRUE
       AND (
         nombre           ILIKE $2 OR
         apellido         ILIKE $2 OR
         razon_social     ILIKE $2 OR
         nit              ILIKE $2 OR
         nrc              ILIKE $2 OR
         numero_documento ILIKE $2
       )
     ORDER BY nombre ASC
     LIMIT 10`,
    [tenantId, `%${termino}%`]
  );

  return rows.map(formatearCliente);
};

/**
 * Obtener un cliente por ID verificando que pertenece al tenant
 */
const obtenerCliente = async ({ tenantId, clienteId }) => {
  const { rows } = await query(
    `SELECT
       id, nombre, apellido, telefono, email,
       tipo_documento, numero_documento,
       nit, nrc, razon_social,
       direccion, municipio, departamento,
       activo, creado_en, actualizado_en
     FROM clientes
     WHERE id = $1 AND tenant_id = $2`,
    [clienteId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Cliente no encontrado.' };
  }

  return formatearCliente(rows[0]);
};

/**
 * Crear un nuevo cliente
 */
const crearCliente = async ({ tenantId, datos }) => {
  const {
    nombre, apellido, telefono, email,
    tipo_documento, numero_documento,
    nit, nrc, razon_social,
    direccion, municipio, departamento,
  } = datos;

  // Verificar NIT duplicado
  if (nit) {
    const { rows: existeNit } = await query(
      'SELECT id FROM clientes WHERE tenant_id = $1 AND nit = $2',
      [tenantId, nit]
    );
    if (existeNit.length > 0) {
      throw { status: 409, mensaje: `Ya existe un cliente registrado con el NIT ${nit}.` };
    }
  }

  // Verificar NRC duplicado
  if (nrc) {
    const { rows: existeNrc } = await query(
      'SELECT id FROM clientes WHERE tenant_id = $1 AND nrc = $2',
      [tenantId, nrc]
    );
    if (existeNrc.length > 0) {
      throw { status: 409, mensaje: `Ya existe un cliente registrado con el NRC ${nrc}.` };
    }
  }

  const { rows } = await query(
    `INSERT INTO clientes (
       tenant_id, nombre, apellido, telefono, email,
       tipo_documento, numero_documento,
       nit, nrc, razon_social,
       direccion, municipio, departamento
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING
       id, nombre, apellido, telefono, email,
       tipo_documento, numero_documento,
       nit, nrc, razon_social,
       direccion, municipio, departamento,
       activo, creado_en`,
    [
      tenantId,
      nombre,
      apellido         || null,
      telefono         || null,
      email            || null,
      tipo_documento   || 'dui',
      numero_documento || null,
      nit              || null,
      nrc              || null,
      razon_social     || null,
      direccion        || null,
      municipio        || null,
      departamento     || null,
    ]
  );

  logger.info('Cliente creado', {
    tenant_id:  tenantId,
    cliente_id: rows[0].id,
    nombre,
    nit: nit || 'N/A',
  });

  return formatearCliente(rows[0]);
};

/**
 * Actualizar un cliente existente
 */
const actualizarCliente = async ({ tenantId, clienteId, datos }) => {
  await obtenerCliente({ tenantId, clienteId });

  if (datos.nit) {
    const { rows: existeNit } = await query(
      'SELECT id FROM clientes WHERE tenant_id = $1 AND nit = $2 AND id != $3',
      [tenantId, datos.nit, clienteId]
    );
    if (existeNit.length > 0) {
      throw { status: 409, mensaje: `Ya existe otro cliente con el NIT ${datos.nit}.` };
    }
  }

  if (datos.nrc) {
    const { rows: existeNrc } = await query(
      'SELECT id FROM clientes WHERE tenant_id = $1 AND nrc = $2 AND id != $3',
      [tenantId, datos.nrc, clienteId]
    );
    if (existeNrc.length > 0) {
      throw { status: 409, mensaje: `Ya existe otro cliente con el NRC ${datos.nrc}.` };
    }
  }

  const camposPermitidos = [
    'nombre', 'apellido', 'telefono', 'email',
    'tipo_documento', 'numero_documento',
    'nit', 'nrc', 'razon_social',
    'direccion', 'municipio', 'departamento',
    'activo',
  ];

  const campos  = [];
  const valores = [];
  let idx = 1;

  for (const campo of camposPermitidos) {
    if (datos[campo] !== undefined) {
      campos.push(`${campo} = $${idx++}`);
      valores.push(datos[campo]);
    }
  }

  if (campos.length === 0) {
    throw { status: 400, mensaje: 'No hay campos para actualizar.' };
  }

  valores.push(clienteId, tenantId);

  const { rows } = await query(
    `UPDATE clientes SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING
       id, nombre, apellido, telefono, email,
       tipo_documento, numero_documento,
       nit, nrc, razon_social,
       direccion, municipio, departamento,
       activo`,
    valores
  );

  logger.info('Cliente actualizado', { cliente_id: clienteId });
  return formatearCliente(rows[0]);
};

/**
 * Desactivar un cliente (soft delete)
 */
const desactivarCliente = async ({ tenantId, clienteId }) => {
  await obtenerCliente({ tenantId, clienteId });

  await query(
    'UPDATE clientes SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [clienteId, tenantId]
  );

  logger.info('Cliente desactivado', { cliente_id: clienteId });
};

module.exports = {
  listarClientes,
  buscarClientes,
  obtenerCliente,
  crearCliente,
  actualizarCliente,
  desactivarCliente,
};
