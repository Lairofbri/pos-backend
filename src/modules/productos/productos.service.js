// src/modules/productos/productos.service.js
// Lógica de negocio del módulo de productos y categorías
// Principio S (SOLID): solo opera con datos, no valida ni responde HTTP
// Principio O (SOLID): extensible sin modificar — agregar métodos no rompe los existentes

const { query } = require('../../config/database');
const { subirImagen, eliminarImagen } = require('../../config/storage');
const logger = require('../../utils/logger');

// ═════════════════════════════════════════════
// CATEGORÍAS
// ═════════════════════════════════════════════

/**
 * Listar todas las categorías del tenant (lista plana)
 * Ordenadas por orden ASC, nombre ASC
 */
const listarCategorias = async ({ tenantId, soloActivas = true }) => {
  const condicion = soloActivas
    ? 'WHERE tenant_id = $1 AND activo = TRUE'
    : 'WHERE tenant_id = $1';

  const { rows } = await query(
    `SELECT id, parent_id, nombre, descripcion, orden, icono, color, activo, creado_en
     FROM categorias
     ${condicion}
     ORDER BY orden ASC, nombre ASC`,
    [tenantId]
  );
  return rows;
};

/**
 * Obtener el árbol completo de categorías con CTE recursivo
 */
const listarArbolCategorias = async ({ tenantId, soloActivas = true }) => {
  const condicion = soloActivas ? 'FALSE' : 'TRUE';

  const { rows } = await query(
    `WITH RECURSIVE arbol AS (
       SELECT id, parent_id, nombre, descripcion, orden, icono, color, activo, creado_en, 0 AS nivel
       FROM categorias
       WHERE tenant_id = $1 AND parent_id IS NULL AND (${condicion} OR activo = TRUE)
       UNION ALL
       SELECT c.id, c.parent_id, c.nombre, c.descripcion, c.orden, c.icono, c.color, c.activo, c.creado_en, a.nivel + 1
       FROM categorias c
       JOIN arbol a ON c.parent_id = a.id
        WHERE c.tenant_id = $1 AND (${condicion} OR c.activo = TRUE) AND a.nivel < 3
      )
      SELECT id, parent_id, nombre, descripcion, orden, icono, color, activo, creado_en, nivel
     FROM arbol
     ORDER BY nivel, orden ASC, nombre ASC`,
    [tenantId]
  );

  const mapa = {};
  for (const c of rows) {
    c.hijos = [];
    mapa[c.id] = c;
  }

  const arbol = [];
  for (const c of rows) {
    if (c.parent_id && mapa[c.parent_id]) {
      mapa[c.parent_id].hijos.push(c);
    } else if (!c.parent_id) {
      arbol.push(c);
    }
  }

  return arbol;
};

/**
 * Obtener una categoría por ID verificando que pertenece al tenant
 * Incluye información de padre e hijos
 */
const obtenerCategoria = async ({ tenantId, categoriaId }) => {
  const { rows } = await query(
    `SELECT c.id, c.parent_id, c.nombre, c.descripcion, c.orden, c.icono, c.color, c.activo, c.creado_en,
            (SELECT jsonb_agg(jsonb_build_object('id', h.id, 'nombre', h.nombre))
             FROM categorias h WHERE h.parent_id = c.id AND h.tenant_id = c.tenant_id
            ) AS hijos,
            (SELECT COUNT(*) FROM categorias h WHERE h.parent_id = c.id AND h.tenant_id = c.tenant_id) AS total_hijos
     FROM categorias c
     WHERE c.id = $1 AND c.tenant_id = $2`,
    [categoriaId, tenantId]
  );
  if (rows.length === 0) {
    throw { status: 404, mensaje: 'Categoría no encontrada.' };
  }

  const categoria = rows[0];
  categoria.hijos = categoria.hijos || [];
  delete categoria.total_hijos;
  return categoria;
};

/**
 * Crear una nueva categoría
 * Si tiene parent_id, verifica que exista y pertenezca al mismo tenant
 */
const crearCategoria = async ({ tenantId, datos }) => {
  const { nombre, descripcion, parent_id, orden, icono, color } = datos;

  if (parent_id) {
    await validarCategoriaPadre({ tenantId, parentId: parent_id });
    const nivelPadre = await calcularNivelCategoria({ tenantId, categoriaId: parent_id });
    if (nivelPadre >= 2) {
      throw { status: 400, mensaje: 'Máximo 3 niveles de categorías. No se pueden crear subcategorías más profundas.' };
    }
  }

  const { rows } = await query(
    `INSERT INTO categorias (tenant_id, nombre, descripcion, parent_id, orden, icono, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, parent_id, nombre, descripcion, orden, icono, color, activo, creado_en`,
    [tenantId, nombre, descripcion || null, parent_id || null, orden ?? 0, icono || null, color || null]
  );

  logger.info('Categoría creada', { tenant_id: tenantId, nombre, parent_id: parent_id || null });
  return rows[0];
};

/**
 * Validar que una categoría padre existe y pertenece al tenant
 */
const validarCategoriaPadre = async ({ tenantId, parentId }) => {
  const { rows } = await query(
    'SELECT id FROM categorias WHERE id = $1 AND tenant_id = $2',
    [parentId, tenantId]
  );
  if (rows.length === 0) {
    throw { status: 404, mensaje: 'La categoría padre indicada no existe.' };
  }
};

/**
 * Verificar si una categoría es hoja (no tiene hijos)
 */
const esCategoriaHoja = async ({ tenantId, categoriaId }) => {
  const { rows } = await query(
    'SELECT COUNT(*) AS total FROM categorias WHERE parent_id = $1 AND tenant_id = $2',
    [categoriaId, tenantId]
  );
  return parseInt(rows[0].total) === 0;
};

/**
 * Calcular el nivel de profundidad de una categoría
 * 0 = raíz, 1 = subcategoría, 2 = sub-subcategoría, etc.
 */
const calcularNivelCategoria = async ({ tenantId, categoriaId }) => {
  const { rows } = await query(
    `WITH RECURSIVE ancestros AS (
       SELECT id, parent_id, 0 AS nivel
       FROM categorias
       WHERE id = $1 AND tenant_id = $2
       UNION ALL
       SELECT c.id, c.parent_id, a.nivel + 1
       FROM categorias c
       JOIN ancestros a ON c.id = a.parent_id
       WHERE c.tenant_id = $2
     )
     SELECT MAX(nivel) AS nivel FROM ancestros`,
    [categoriaId, tenantId]
  );
  return rows[0]?.nivel ?? 0;
};

/**
 * Actualizar una categoría existente
 * Solo actualiza los campos enviados (PATCH semántico)
 */
const actualizarCategoria = async ({ tenantId, categoriaId, datos }) => {
  await obtenerCategoria({ tenantId, categoriaId });

  if (datos.parent_id !== undefined) {
    if (datos.parent_id === categoriaId) {
      throw { status: 400, mensaje: 'Una categoría no puede ser padre de sí misma.' };
    }
    if (datos.parent_id) {
      await validarCategoriaPadre({ tenantId, parentId: datos.parent_id });
      const nivelPadre = await calcularNivelCategoria({ tenantId, categoriaId: datos.parent_id });
      if (nivelPadre >= 2) {
        throw { status: 400, mensaje: 'Máximo 3 niveles de categorías. No se pueden crear subcategorías más profundas.' };
      }
    }
  }

  const campos  = [];
  const valores = [];
  let idx = 1;

  if (datos.nombre      !== undefined) { campos.push(`nombre = $${idx++}`);      valores.push(datos.nombre); }
  if (datos.descripcion !== undefined) { campos.push(`descripcion = $${idx++}`); valores.push(datos.descripcion); }
  if (datos.parent_id   !== undefined) { campos.push(`parent_id = $${idx++}`);   valores.push(datos.parent_id); }
  if (datos.orden       !== undefined) { campos.push(`orden = $${idx++}`);       valores.push(datos.orden); }
  if (datos.icono       !== undefined) { campos.push(`icono = $${idx++}`);       valores.push(datos.icono); }
  if (datos.color       !== undefined) { campos.push(`color = $${idx++}`);       valores.push(datos.color); }
  if (datos.activo      !== undefined) { campos.push(`activo = $${idx++}`);      valores.push(datos.activo); }

  valores.push(categoriaId, tenantId);

  const { rows } = await query(
    `UPDATE categorias SET ${campos.join(', ')}
     WHERE id = $${idx++} AND tenant_id = $${idx}
     RETURNING id, parent_id, nombre, descripcion, orden, icono, color, activo`,
    valores
  );

  logger.info('Categoría actualizada', { categoria_id: categoriaId });
  return rows[0];
};

/**
 * Desactivar una categoría (soft delete)
 * No se puede desactivar si tiene hijos activos
 */
const desactivarCategoria = async ({ tenantId, categoriaId }) => {
  await obtenerCategoria({ tenantId, categoriaId });

  const esHoja = await esCategoriaHoja({ tenantId, categoriaId });
  if (!esHoja) {
    throw { status: 400, mensaje: 'No se puede desactivar una categoría que tiene subcategorías. Desactive o reasigne las subcategorías primero.' };
  }

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

  // Filtro por categoría (con expansión de subcategorías via CTE recursivo)
  let cte = '';
  if (categoria_id) {
    const cteIdx = idx++;
    valores.push(categoria_id);
    cte = `WITH RECURSIVE subcats AS (
      SELECT id FROM categorias WHERE id = $${cteIdx} AND tenant_id = $1
      UNION ALL
      SELECT c.id FROM categorias c JOIN subcats s ON c.parent_id = s.id
    ) `;
    condiciones.push(`p.categoria_id IN (SELECT id FROM subcats)`);
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
    `${cte}SELECT
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
    `${cte}SELECT COUNT(*) as total
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

  // Si tiene categoría, verificar que es hoja y pertenece al tenant
  if (categoria_id) {
    await obtenerCategoria({ tenantId, categoriaId: categoria_id });
    const esHoja = await esCategoriaHoja({ tenantId, categoriaId: categoria_id });
    if (!esHoja) {
      throw { status: 400, mensaje: 'Solo se pueden asignar productos a categorías hoja (sin subcategorías).' };
    }
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

  // Si cambia la categoría, verificar que es hoja y pertenece al tenant
  if (datos.categoria_id) {
    await obtenerCategoria({ tenantId, categoriaId: datos.categoria_id });
    const esHoja = await esCategoriaHoja({ tenantId, categoriaId: datos.categoria_id });
    if (!esHoja) {
      throw { status: 400, mensaje: 'Solo se pueden asignar productos a categorías hoja (sin subcategorías).' };
    }
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

/**
 * Subir imagen a R2 y actualizar imagen_url del producto
 */
const subirImagenProducto = async ({ tenantId, productoId, buffer, mimetype }) => {
  await obtenerProducto({ tenantId, productoId });

  const imagenUrl = await subirImagen({ tenantId, productoId, buffer, mimetype });

  const { rows } = await query(
    `UPDATE productos SET imagen_url = $1
     WHERE id = $2 AND tenant_id = $3
     RETURNING id, nombre, imagen_url`,
    [imagenUrl, productoId, tenantId]
  );

  logger.info('Imagen asignada a producto', { producto_id: productoId, tenant_id: tenantId });
  return rows[0];
};

/**
 * Eliminar imagen de R2 y limpiar imagen_url del producto
 */
const eliminarImagenProducto = async ({ tenantId, productoId }) => {
  const producto = await obtenerProducto({ tenantId, productoId });

  if (!producto.imagen_url) {
    throw { status: 404, mensaje: 'El producto no tiene imagen asignada.' };
  }

  await eliminarImagen({ tenantId, productoId });

  const { rows } = await query(
    `UPDATE productos SET imagen_url = NULL
     WHERE id = $1 AND tenant_id = $2
     RETURNING id, nombre, imagen_url`,
    [productoId, tenantId]
  );

  logger.info('Imagen eliminada de producto', { producto_id: productoId, tenant_id: tenantId });
  return rows[0];
};

module.exports = {
  // Categorías
  listarCategorias,
  listarArbolCategorias,
  obtenerCategoria,
  crearCategoria,
  actualizarCategoria,
  desactivarCategoria,
  esCategoriaHoja,
  // Productos
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  toggleProducto,
  desactivarProducto,
  ajustarStock,
  productosStockBajo,
  // Imágenes
  subirImagenProducto,
  eliminarImagenProducto,
};
