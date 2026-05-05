// src/modules/productos/productos.service.js
// Lógica de negocio del módulo de productos y categorías
// Principio S (SOLID): solo opera con datos, no valida ni responde HTTP
// Principio O (SOLID): extensible sin modificar — agregar métodos no rompe los existentes

const { query } = require('../../config/database');
const logger    = require('../../utils/logger');

// ═════════════════════════════════════════════
// CATEGORÍAS
// ═════════════════════════════════════════════

/**
 * Listar todas las categorías activas del tenant
 * Ordenadas por el campo `orden` para respetar el orden del menú
 */
const listarCategorias = async ({ tenantId, soloActivas = true }) => {
  const condicion = soloActivas
    ? 'WHERE tenant_id = $1 AND activo = TRUE'
    : 'WHERE tenant_id = $1';

  const { rows } = await query(
    `SELECT id, nombre, descripcion, orden, color, activo, creado_en
     FROM categorias
     ${condicion}
     ORDER BY orden ASC, nombre ASC`,
    [tenantId]
  );
  return rows;
};

/**
 * Obtener una categoría por ID verificando que pertenece al tenant
 */
const obtenerCategoria = async ({ tenantId, categoriaId }) => {
  const { rows } = await query(
    `SELECT id, nombre, descripcion, orden, color, activo, creado_en
     FROM categorias
     WHERE id = $1 AND tenant_id = $2`,
    [categoriaId, tenantId]
  );
  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Categoría no encontrada.' };
  }
  return rows[0];
};

/**
 * Crear una nueva categoría
 * Verifica que no exista otra con el mismo nombre en el tenant
 */
const crearCategoria = async ({ tenantId, datos }) => {
  const { nombre, descripcion, orden, color } = datos;

  const { rows } = await query(
    `INSERT INTO categorias (tenant_id, nombre, descripcion, orden, color)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, descripcion, orden, color, activo, creado_en`,
    [tenantId, nombre, descripcion || null, orden ?? 0, color || null]
  );

  logger.info('Categoría creada', { tenant_id: tenantId, nombre });
  return rows[0];
};

/**
 * Actualizar una categoría existente
 * Solo actualiza los campos enviados (PATCH semántico)
 */
const actualizarCategoria = async ({ tenantId, categoriaId, datos }) => {
  // Verificar que existe
  await obtenerCategoria({ tenantId, categoriaId });

  // Construir SET dinámico
  const campos  = [];
  const valores = [];
  let idx = 1;

  if (datos.nombre      !== undefined) { campos.push(`nombre = $${idx++}`);      valores.push(datos.nombre); }
  if (datos.descripcion !== undefined) { campos.push(`descripcion = $${idx++}`); valores.push(datos.descripcion); }
  if (datos.orden       !== undefined) { campos.push(`orden = $${idx++}`);       valores.push(datos.orden); }
  if (datos.color       !== undefined) { campos.push(`color = $${idx++}`);       valores.push(datos.color); }
  if (datos.activo      !== undefined) { campos.push(`activo = $${idx++}`);      valores.push(datos.activo); }

  valores.push(categoriaId, tenantId);

  const { rows } = await query(
    `UPDATE categorias SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, nombre, descripcion, orden, color, activo`,
    valores
  );

  logger.info('Categoría actualizada', { categoria_id: categoriaId });
  return rows[0];
};

/**
 * Desactivar una categoría (soft delete)
 * No elimina de la BD para mantener historial de ventas
 */
const desactivarCategoria = async ({ tenantId, categoriaId }) => {
  await obtenerCategoria({ tenantId, categoriaId });

  await query(
    'UPDATE categorias SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [categoriaId, tenantId]
  );

  logger.info('Categoría desactivada', { categoria_id: categoriaId });
};

// ═════════════════════════════════════════════
// PRODUCTOS
// ═════════════════════════════════════════════

/**
 * Listar productos con filtros opcionales
 * Incluye el nombre de la categoría en cada producto
 * Soporta búsqueda por texto, filtro por categoría y paginación
 */
const listarProductos = async ({ tenantId, filtros = {} }) => {
  const {
    categoria_id,
    activo,
    busqueda,
    con_stock,
    pagina  = 1,
    limite  = 50,
  } = filtros;

  const condiciones = ['p.tenant_id = $1'];
  const valores     = [tenantId];
  let idx = 2;

  // Filtro por estado activo/inactivo
  if (activo !== undefined) {
    condiciones.push(`p.activo = $${idx++}`);
    valores.push(activo);
  }

  // Filtro por categoría
  if (categoria_id) {
    condiciones.push(`p.categoria_id = $${idx++}`);
    valores.push(categoria_id);
  }

  // Búsqueda por texto en nombre y descripción
  if (busqueda && busqueda.trim()) {
    condiciones.push(`(p.nombre ILIKE $${idx} OR p.descripcion ILIKE $${idx})`);
    valores.push(`%${busqueda.trim()}%`);
    idx++;
  }

  // Solo productos con stock disponible
  if (con_stock) {
    condiciones.push(`(p.tiene_stock = FALSE OR p.stock_actual > 0)`);
  }

  const offset = (pagina - 1) * limite;

  // Query principal con JOIN a categorías
  const { rows } = await query(
    `SELECT
       p.id, p.nombre, p.descripcion, p.precio,
       p.imagen_url, p.tiene_stock, p.stock_actual, p.stock_minimo,
       p.codigo, p.activo, p.orden, p.creado_en,
       p.categoria_id,
       c.nombre AS categoria_nombre,
       c.color  AS categoria_color
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY c.orden ASC NULLS LAST, p.orden ASC, p.nombre ASC
     LIMIT $${idx++} OFFSET $${idx}`,
    [...valores, limite, offset]
  );

  // Conteo total para paginación
  const { rows: conteo } = await query(
    `SELECT COUNT(*) as total
     FROM productos p
     WHERE ${condiciones.join(' AND ')}`,
    valores
  );

  return {
    productos: rows,
    paginacion: {
      total:   parseInt(conteo[0].total),
      pagina,
      limite,
      paginas: Math.ceil(parseInt(conteo[0].total) / limite),
    },
  };
};

/**
 * Obtener un producto por ID verificando que pertenece al tenant
 */
const obtenerProducto = async ({ tenantId, productoId }) => {
  const { rows } = await query(
    `SELECT
       p.id, p.nombre, p.descripcion, p.precio,
       p.imagen_url, p.tiene_stock, p.stock_actual, p.stock_minimo,
       p.codigo, p.activo, p.orden, p.creado_en,
       p.categoria_id,
       c.nombre AS categoria_nombre,
       c.color  AS categoria_color
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [productoId, tenantId]
  );

  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Producto no encontrado.' };
  }
  return rows[0];
};

/**
 * Crear un nuevo producto
 */
const crearProducto = async ({ tenantId, datos }) => {
  const {
    nombre, descripcion, precio, categoria_id,
    imagen_url, tiene_stock, stock_actual, stock_minimo,
    codigo, orden,
  } = datos;

  // Si tiene categoría, verificar que pertenece al tenant
  if (categoria_id) {
    await obtenerCategoria({ tenantId, categoriaId: categoria_id });
  }

  const { rows } = await query(
    `INSERT INTO productos
       (tenant_id, categoria_id, nombre, descripcion, precio,
        imagen_url, tiene_stock, stock_actual, stock_minimo, codigo, orden)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING
       id, nombre, descripcion, precio, imagen_url,
       tiene_stock, stock_actual, stock_minimo,
       codigo, activo, orden, categoria_id, creado_en`,
    [
      tenantId,
      categoria_id  || null,
      nombre,
      descripcion   || null,
      precio,
      imagen_url    || null,
      tiene_stock   ?? false,
      stock_actual  ?? 0,
      stock_minimo  ?? 0,
      codigo        || null,
      orden         ?? 0,
    ]
  );

  logger.info('Producto creado', { tenant_id: tenantId, nombre, precio });
  return rows[0];
};

/**
 * Actualizar un producto existente
 * Solo actualiza los campos enviados (PATCH semántico)
 */
const actualizarProducto = async ({ tenantId, productoId, datos }) => {
  await obtenerProducto({ tenantId, productoId });

  // Si cambia la categoría, verificar que existe en el tenant
  if (datos.categoria_id) {
    await obtenerCategoria({ tenantId, categoriaId: datos.categoria_id });
  }

  // Construir SET dinámico — solo campos enviados
  const campos  = [];
  const valores = [];
  let idx = 1;

  const camposPermitidos = [
    'nombre', 'descripcion', 'precio', 'categoria_id',
    'imagen_url', 'tiene_stock', 'stock_actual', 'stock_minimo',
    'codigo', 'orden', 'activo',
  ];

  for (const campo of camposPermitidos) {
    if (datos[campo] !== undefined) {
      campos.push(`${campo} = $${idx++}`);
      valores.push(datos[campo]);
    }
  }

  if (campos.length === 0) {
    throw { status: 400, mensaje: 'No hay campos para actualizar.' };
  }

  valores.push(productoId, tenantId);

  const { rows } = await query(
    `UPDATE productos SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING
       id, nombre, descripcion, precio, imagen_url,
       tiene_stock, stock_actual, stock_minimo,
       codigo, activo, orden, categoria_id`,
    valores
  );

  logger.info('Producto actualizado', { producto_id: productoId });
  return rows[0];
};

/**
 * Activar o desactivar un producto rápidamente
 * Usado desde el POS para marcar "agotado" o "disponible"
 */
const toggleProducto = async ({ tenantId, productoId }) => {
  const producto = await obtenerProducto({ tenantId, productoId });
  const nuevoEstado = !producto.activo;

  await query(
    'UPDATE productos SET activo = $1 WHERE id = $2 AND tenant_id = $3',
    [nuevoEstado, productoId, tenantId]
  );

  logger.info('Producto toggled', { producto_id: productoId, activo: nuevoEstado });
  return { activo: nuevoEstado };
};

/**
 * Desactivar un producto (soft delete)
 */
const desactivarProducto = async ({ tenantId, productoId }) => {
  await obtenerProducto({ tenantId, productoId });

  await query(
    'UPDATE productos SET activo = FALSE WHERE id = $1 AND tenant_id = $2',
    [productoId, tenantId]
  );

  logger.info('Producto desactivado', { producto_id: productoId });
};

/**
 * Ajustar stock de un producto
 * tipo: 'suma' | 'resta' | 'absoluto'
 */
const ajustarStock = async ({ tenantId, productoId, cantidad, tipo, motivo }) => {
  const producto = await obtenerProducto({ tenantId, productoId });

  if (!producto.tiene_stock) {
    throw { status: 400, mensaje: 'Este producto no tiene control de inventario activado.' };
  }

  let nuevoStock;
  if (tipo === 'suma')     nuevoStock = producto.stock_actual + cantidad;
  if (tipo === 'resta')    nuevoStock = producto.stock_actual - cantidad;
  if (tipo === 'absoluto') nuevoStock = cantidad;

  if (nuevoStock < 0) {
    throw { status: 400, mensaje: `Stock insuficiente. Stock actual: ${producto.stock_actual}.` };
  }

  const { rows } = await query(
    `UPDATE productos SET stock_actual = $1
     WHERE id = $2 AND tenant_id = $3
     RETURNING id, nombre, stock_actual, stock_minimo`,
    [nuevoStock, productoId, tenantId]
  );

  logger.info('Stock ajustado', {
    producto_id: productoId,
    tipo,
    cantidad,
    stock_anterior: producto.stock_actual,
    stock_nuevo: nuevoStock,
    motivo,
  });

  return rows[0];
};

/**
 * Obtener productos con stock bajo (para alertas en el panel admin)
 */
const productosStockBajo = async ({ tenantId }) => {
  const { rows } = await query(
    `SELECT id, nombre, stock_actual, stock_minimo, categoria_id
     FROM productos
     WHERE tenant_id = $1
       AND tiene_stock = TRUE
       AND activo = TRUE
       AND stock_actual <= stock_minimo
     ORDER BY stock_actual ASC`,
    [tenantId]
  );
  return rows;
};

module.exports = {
  // Categorías
  listarCategorias,
  obtenerCategoria,
  crearCategoria,
  actualizarCategoria,
  desactivarCategoria,
  // Productos
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  toggleProducto,
  desactivarProducto,
  ajustarStock,
  productosStockBajo,
};
